import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Pen, Eraser, Trash2, Undo2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';
import {
  InkPoint,
  buildWidthRuns,
  fromFlatArray,
  shouldIgnorePointer,
} from '../lib/whiteboard/ink';
import { StrokeBuilder } from '../lib/whiteboard/strokeBuilder';

interface Stroke {
  id: string;
  tool: 'pen' | 'eraser';
  points: number[];
  /** Per-point widths for pressure/velocity ink; absent on legacy strokes. */
  widths?: number[];
  color: string;
  strokeWidth: number;
  userId?: string;
}

const MIN_SAMPLE_DISTANCE = 2;

interface LiveCanvasProps {
  classroomId: string;
}

export const LiveCanvas: React.FC<LiveCanvasProps> = ({ classroomId }) => {
  const { t } = useTranslation('liveCanvas');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#4f46e5'); // Indigo 600
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  // Ink pipeline for the stroke in progress, plus palm-rejection state.
  const builderRef = useRef<StrokeBuilder | null>(null);
  const pointerTypeRef = useRef<string>('mouse');
  const penLastSeenRef = useRef<number | null>(null);

  // Resize observer for responsive canvas
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Real-time sync
  useEffect(() => {
    if (!classroomId) return;

    const q = query(
      collection(db, `classrooms/${classroomId}/canvas_strokes`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStrokes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Stroke));
      setStrokes(fetchedStrokes);
    });

    return () => unsubscribe();
  }, [classroomId]);

  /** Reads a Konva pointer event into an ink sample, or null if it must be ignored. */
  const readSample = (e: any): InkPoint | null => {
    const evt: PointerEvent | undefined = e?.evt;
    const pointerType = evt?.pointerType || 'mouse';
    const now = evt?.timeStamp ?? performance.now();

    if (pointerType === 'pen') penLastSeenRef.current = now;
    // Palm rejection: the hand resting on the tablet is not drawing input.
    if (shouldIgnorePointer({ pointerType, penLastSeenAt: penLastSeenRef.current, now })) return null;

    const pos = e?.target?.getStage?.()?.getPointerPosition?.();
    if (!pos) return null;

    pointerTypeRef.current = pointerType;
    return { x: pos.x, y: pos.y, pressure: evt?.pressure, t: now };
  };

  const handlePointerDown = (e: any) => {
    const sample = readSample(e);
    if (!sample) return;

    setIsDrawing(true);
    const baseWidth = tool === 'eraser' ? 20 : strokeWidth;
    const builder = new StrokeBuilder(sample, {
      baseWidth,
      pointerType: pointerTypeRef.current,
      minSampleDistance: MIN_SAMPLE_DISTANCE,
    });

    const newStroke: Stroke = {
      id: `temp_${Date.now()}`,
      tool,
      points: [sample.x, sample.y],
      widths: [builder.initialWidth],
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: baseWidth,
      userId: auth.currentUser?.uid
    };
    currentStrokeRef.current = newStroke;
    builderRef.current = builder;
    setStrokes([...strokes, newStroke]);
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing || !currentStrokeRef.current || !builderRef.current) return;

    const sample = readSample(e);
    if (!sample) return;

    const increment = builderRef.current.addSample(sample);
    if (!increment) return;

    const updated: Stroke = {
      ...currentStrokeRef.current,
      points: currentStrokeRef.current.points.concat(increment.points),
      widths: (currentStrokeRef.current.widths ?? []).concat(increment.widths),
    };
    currentStrokeRef.current = updated;

    // Optimistic update
    setStrokes(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handlePointerUp = async () => {
    setIsDrawing(false);
    if (!currentStrokeRef.current) return;

    const closing = builderRef.current?.finish();
    if (closing) {
      currentStrokeRef.current = {
        ...currentStrokeRef.current,
        points: currentStrokeRef.current.points.concat(closing.points),
        widths: (currentStrokeRef.current.widths ?? []).concat(closing.widths),
      };
    }

    const strokeToSave = { ...currentStrokeRef.current };
    currentStrokeRef.current = null;
    builderRef.current = null;

    try {
      // Remove temp id and save to Firestore
      const { id, ...strokeData } = strokeToSave;
      await addDoc(collection(db, `classrooms/${classroomId}/canvas_strokes`), {
        ...strokeData,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving stroke:", error);
    }
  };

  const handleUndo = async () => {
    if (strokes.length === 0) return;
    
    // Find the last stroke made by the current user
    const userStrokes = strokes.filter(s => s.userId === auth.currentUser?.uid);
    if (userStrokes.length === 0) return;
    
    const lastStroke = userStrokes[userStrokes.length - 1];
    
    // Optimistic update
    setStrokes(strokes.filter(s => s.id !== lastStroke.id));
    
    // Delete from Firestore
    if (!lastStroke.id.startsWith('temp_')) {
      try {
        await deleteDoc(doc(db, `classrooms/${classroomId}/canvas_strokes`, lastStroke.id));
      } catch (error) {
        console.error("Error undoing stroke:", error);
      }
    }
  };

  const handleClear = async () => {
    if (window.confirm(t('confirmClear'))) {
      // Optimistic update
      setStrokes([]);
      
      try {
        // Delete all strokes from Firestore
        const q = query(collection(db, `classrooms/${classroomId}/canvas_strokes`));
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error clearing canvas:", error);
      }
    }
  };

  /**
   * Variable-width strokes render as a few constant-width runs; strokes saved
   * before this feature carry no widths and keep their single line.
   */
  const renderedStrokes = useMemo(() => strokes.map((stroke, i) => ({
    id: stroke.id || `stroke-${i}`,
    color: stroke.color,
    tool: stroke.tool,
    runs: stroke.widths?.length
      ? buildWidthRuns(fromFlatArray(stroke.points), stroke.widths)
      : [{ points: stroke.points, width: stroke.strokeWidth }],
  })), [strokes]);

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              title={t('pen')}
            >
              <Pen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              title={t('eraser')}
            >
              <Eraser className="w-5 h-5" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300"></div>

          <div className="flex items-center gap-2">
            {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c && tool === 'pen' ? 'scale-125 border-slate-400' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-slate-300"></div>

          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-24 accent-indigo-600"
            title={t('thickness')}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo}
            disabled={strokes.filter(s => s.userId === auth.currentUser?.uid).length === 0}
            className="text-slate-600 border-slate-200 hover:bg-slate-100"
            title={t('undo')}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            title={t('clearAll')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 w-full relative bg-white cursor-crosshair touch-none select-none [overscroll-behavior:none]"
        onContextMenu={(e) => e.preventDefault()}
      >
        <Stage
          width={containerSize.width}
          height={containerSize.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <Layer>
            {renderedStrokes.map(stroke =>
              stroke.runs.map((run, i) => (
                <Line
                  key={`${stroke.id}-${i}`}
                  points={run.points}
                  stroke={stroke.color}
                  strokeWidth={run.width}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

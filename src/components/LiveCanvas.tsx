import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Pen, Eraser, Trash2, Undo2 } from 'lucide-react';
import { Button } from './ui/Button';

interface Stroke {
  id: string;
  tool: 'pen' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
  userId?: string;
}

interface LiveCanvasProps {
  classroomId: string;
}

export const LiveCanvas: React.FC<LiveCanvasProps> = ({ classroomId }) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#4f46e5'); // Indigo 600
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);

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

  const handleMouseDown = (e: any) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newStroke: Stroke = {
      id: `temp_${Date.now()}`,
      tool,
      points: [pos.x, pos.y],
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: tool === 'eraser' ? 20 : strokeWidth,
      userId: auth.currentUser?.uid
    };
    currentStrokeRef.current = newStroke;
    setStrokes([...strokes, newStroke]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentStrokeRef.current) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    const lastStroke = { ...currentStrokeRef.current };
    lastStroke.points = lastStroke.points.concat([point.x, point.y]);
    
    currentStrokeRef.current = lastStroke;

    // Optimistic update
    setStrokes(strokes.map(s => s.id === lastStroke.id ? lastStroke : s));
  };

  const handleMouseUp = async () => {
    setIsDrawing(false);
    if (!currentStrokeRef.current) return;

    const strokeToSave = { ...currentStrokeRef.current };
    currentStrokeRef.current = null;

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
    if (window.confirm('Дали сте сигурни дека сакате да ја избришете целата табла?')) {
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

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Пенкало"
            >
              <Pen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              title="Бришач"
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
            title="Дебелина"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo}
            disabled={strokes.filter(s => s.userId === auth.currentUser?.uid).length === 0}
            className="text-slate-600 border-slate-200 hover:bg-slate-100"
            title="Врати назад (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClear}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            title="Избриши сè"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 w-full relative bg-white cursor-crosshair">
        <Stage
          width={containerSize.width}
          height={containerSize.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {strokes.map((stroke, i) => (
              <Line
                key={stroke.id || i}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

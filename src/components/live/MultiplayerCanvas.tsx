import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Line as KonvaLine } from 'react-konva';
import { io, Socket } from 'socket.io-client';
import { Brain, Eraser, PenTool, Save, Loader2, Download, Undo2, Redo2, Shapes } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { motion } from 'motion/react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { recognizeHandwrittenMath } from '../../lib/gemini';
import { useToast } from '../../contexts/ToastContext';
import {
  InkPoint,
  buildWidthRuns,
  fromFlatArray,
  shouldIgnorePointer,
} from '../../lib/whiteboard/ink';
import { StrokeBuilder } from '../../lib/whiteboard/strokeBuilder';
import { describeToJsxGraphBlock } from '../../lib/whiteboard/shapeParser';
import {
  BoardState,
  CanvasEvent,
  LatexBox,
  Stroke,
  appendLocalPoints,
  applyCanvasEvent,
  buildPointsChunk,
  createBoardState,
  lastStrokeOf,
  POINT_STREAM_THROTTLE_MS,
} from '../../lib/whiteboard/sync';

interface MultiplayerCanvasProps {
  roomId?: string;
  isTeacher?: boolean;
}

/** Minimum travel between kept samples — pointer devices oversample heavily. */
const MIN_SAMPLE_DISTANCE = 2;
const PEN_BASE_WIDTH = 3;
const ERASER_BASE_WIDTH = 20;

const newId = () => Math.random().toString(36).slice(2, 11);

export const MultiplayerCanvas: React.FC<MultiplayerCanvasProps> = ({
  roomId = 'global-math-board',
  isTeacher = false
}) => {
  const { t } = useTranslation('liveCanvas');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [board, setBoard] = useState<BoardState>(() => createBoardState());
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#4f46e5');
  const { showToast } = useToast();
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shapeText, setShapeText] = useState('');

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  /** Stable identity for authorship, undo ownership and snapshot addressing. */
  const clientIdRef = useRef<string>(auth.currentUser?.uid || `guest-${newId()}`);
  const clientId = clientIdRef.current;

  // Live-drawing scratch state. Refs, not state: these change on every pointer
  // sample and must never trigger a render on their own.
  const drawingRef = useRef<{
    strokeId: string;
    seq: number;
    builder: StrokeBuilder;
    pendingPoints: number[];
    pendingWidths: number[];
    lastFlush: number;
  } | null>(null);
  const penLastSeenRef = useRef<number | null>(null);
  const redoStackRef = useRef<Stroke[]>([]);
  const boardRef = useRef(board);
  boardRef.current = board;
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = socket;

  const emitEvent = useCallback((event: CanvasEvent) => {
    socketRef.current?.emit('canvas-event', { roomId, event });
  }, [roomId]);

  /** Applies an event locally through the same reducer the remote side uses. */
  const dispatchLocal = useCallback((event: CanvasEvent) => {
    setBoard(prev => applyCanvasEvent(prev, event, clientId));
  }, [clientId]);

  const dispatchAndEmit = useCallback((event: CanvasEvent) => {
    dispatchLocal(event);
    emitEvent(event);
  }, [dispatchLocal, emitEvent]);

  useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const sessionParam = params.get('session');
     if (sessionParam && !initialLoadDone) {
        setSessionId(sessionParam);
        getDoc(doc(db, 'whiteboard_sessions', sessionParam)).then(snap => {
           if (snap.exists()) {
              const data = snap.data();
              setBoard(createBoardState(data.strokes || [], data.latexBoxes || []));
           }
        }).catch(err => console.error(err)).finally(() => setInitialLoadDone(true));
     } else {
        setInitialLoadDone(true);
     }
  }, [initialLoadDone]);

  useEffect(() => {
    const newSocket = io(window.location.protocol + '//' + window.location.host);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', roomId);
      // Late-join: ask whoever is already in the room for the current board.
      newSocket.emit('canvas-event', {
        roomId,
        event: { type: 'snapshot:request', requesterId: clientIdRef.current },
      });
    });

    newSocket.on('canvas-event', (event: CanvasEvent) => {
      if (event.type === 'snapshot:request') {
        // Answer only if we actually hold content, with jitter so a busy room
        // does not answer a joiner all at once.
        const current = boardRef.current;
        if (current.strokes.length === 0 && current.latexBoxes.length === 0) return;
        const requesterId = event.requesterId;
        window.setTimeout(() => {
          newSocket.emit('canvas-event', {
            roomId,
            event: {
              type: 'snapshot:provide',
              to: requesterId,
              strokes: boardRef.current.strokes,
              latexBoxes: boardRef.current.latexBoxes,
            },
          });
        }, 150 + Math.random() * 250);
        return;
      }

      setBoard(prev => applyCanvasEvent(prev, event, clientIdRef.current));
    });

    return () => {
      newSocket.close();
    };
  }, [roomId]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Pointer input (pressure, tilt-aware width, palm rejection) ────────────

  /** Reads a Konva pointer event into an ink sample, or null if it must be ignored. */
  const readSample = (e: any): { point: InkPoint; pointerType: string } | null => {
    const evt: PointerEvent | undefined = e?.evt;
    const pointerType = evt?.pointerType || 'mouse';
    const now = evt?.timeStamp ?? performance.now();

    if (pointerType === 'pen') penLastSeenRef.current = now;
    if (shouldIgnorePointer({ pointerType, penLastSeenAt: penLastSeenRef.current, now })) return null;

    const stage = e?.target?.getStage?.();
    const pos = stage?.getPointerPosition?.();
    if (!pos) return null;

    return {
      point: { x: pos.x, y: pos.y, pressure: evt?.pressure, t: now },
      pointerType,
    };
  };

  const flushPending = (force = false) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pendingPoints.length === 0) return;

    const now = performance.now();
    if (!force && now - drawing.lastFlush < POINT_STREAM_THROTTLE_MS) return;

    const chunk = buildPointsChunk(
      drawing.strokeId,
      drawing.seq + 1,
      drawing.pendingPoints,
      drawing.pendingWidths
    );
    if (chunk) {
      drawing.seq += 1;
      emitEvent(chunk);
    }
    drawing.pendingPoints = [];
    drawing.pendingWidths = [];
    drawing.lastFlush = now;
  };

  const handlePointerDown = (e: any) => {
    if (e.target.getClassName?.() !== 'Stage' && e.target.getClassName?.() !== 'Line') return;

    const sample = readSample(e);
    if (!sample) return;

    const baseWidth = tool === 'eraser' ? ERASER_BASE_WIDTH : PEN_BASE_WIDTH;
    const builder = new StrokeBuilder(sample.point, {
      baseWidth,
      pointerType: sample.pointerType,
      minSampleDistance: MIN_SAMPLE_DISTANCE,
    });

    const stroke: Stroke = {
      id: newId(),
      points: [sample.point.x, sample.point.y],
      widths: [builder.initialWidth],
      color: tool === 'eraser' ? '#ffffff' : color,
      thickness: baseWidth,
      tool,
      authorId: clientId,
    };

    drawingRef.current = {
      strokeId: stroke.id,
      seq: 0,
      builder,
      pendingPoints: [],
      pendingWidths: [],
      lastFlush: performance.now(),
    };

    // A fresh stroke invalidates the redo stack, as in any editor.
    redoStackRef.current = [];
    setCanRedo(false);

    dispatchAndEmit({ type: 'stroke:begin', stroke, seq: 0 });
  };

  const handlePointerMove = (e: any) => {
    const drawing = drawingRef.current;
    if (!drawing) return;

    const sample = readSample(e);
    if (!sample) return;

    // Decimated + incrementally smoothed — exactly what remote peers receive,
    // so the ink is identical on every board.
    const increment = drawing.builder.addSample(sample.point);
    if (!increment) return;

    drawing.pendingPoints.push(...increment.points);
    drawing.pendingWidths.push(...increment.widths);

    setBoard(prev => appendLocalPoints(prev, drawing.strokeId, increment.points, increment.widths));
    flushPending();
  };

  const handlePointerUp = () => {
    const drawing = drawingRef.current;
    if (!drawing) return;

    const closing = drawing.builder.finish();
    if (closing) {
      drawing.pendingPoints.push(...closing.points);
      drawing.pendingWidths.push(...closing.widths);
      setBoard(prev => appendLocalPoints(prev, drawing.strokeId, closing.points, closing.widths));
    }

    flushPending(true);
    emitEvent({ type: 'stroke:end', strokeId: drawing.strokeId, seq: drawing.seq });
    drawingRef.current = null;
  };

  // ─── Undo / redo (per participant) ─────────────────────────────────────────

  const ownLastStroke = lastStrokeOf(board, clientId);

  const handleUndo = () => {
    const target = lastStrokeOf(boardRef.current, clientId);
    if (!target) return;
    redoStackRef.current.push(target);
    setCanRedo(true);
    dispatchAndEmit({ type: 'stroke:undo', strokeId: target.id, authorId: clientId });
  };

  const handleRedo = () => {
    const restored = redoStackRef.current.pop();
    setCanRedo(redoStackRef.current.length > 0);
    if (!restored) return;
    dispatchAndEmit({ type: 'stroke:redo', stroke: restored });
  };

  const clearCanvas = () => {
    redoStackRef.current = [];
    setCanRedo(false);
    dispatchAndEmit({ type: 'stroke:clear' });
  };

  // ─── AI / persistence ──────────────────────────────────────────────────────

  const recognizeInk = async () => {
    if (!stageRef.current) return;
    setIsRecognizing(true);
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
      const base64Data = dataUrl.split(',')[1];

      const latexContent = await recognizeHandwrittenMath(base64Data);
      if (latexContent) {
         const newBox: LatexBox = {
           id: newId(),
           text: latexContent,
           x: dimensions.width / 2 - 100,
           y: dimensions.height / 2
         };
         dispatchAndEmit({ type: 'latex:add', latex: newBox });
      }
    } catch (e) {
      console.error("Failed to recognize ink:", e);
      showToast(t('board.inkFailed'), 'error');
    } finally {
      setIsRecognizing(false);
    }
  };

  /**
   * Text → geometry, parsed deterministically (no model call): the same
   * sentence always draws the same figure, and anything the grammar does not
   * know is reported rather than guessed at.
   */
  const insertShapeFromText = () => {
    const description = shapeText.trim();
    if (!description) return;

    const { code, unrecognized } = describeToJsxGraphBlock(description);
    if (!code) {
      showToast(t('board.shapeNotUnderstood', { description }), 'error');
      return;
    }

    dispatchAndEmit({
      type: 'latex:add',
      latex: {
        id: newId(),
        text: code,
        kind: 'geometry',
        x: Math.max(16, dimensions.width / 2 - 160),
        y: Math.max(16, dimensions.height / 2 - 140),
      },
    });
    setShapeText('');

    if (unrecognized.length > 0) {
      showToast(t('board.shapePartial', { items: unrecognized.join('; ') }), 'info');
    }
  };

  const handleBoxDrag = (id: string, e: React.DragEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const existing = board.latexBoxes.find(b => b.id === id);
    if (!existing) return;

    const moved: LatexBox = {
      ...existing,
      x: e.clientX - rect.left - 50,
      y: e.clientY - rect.top - 20,
    };
    dispatchAndEmit({ type: 'latex:move', latex: moved });
  };

  const exportToPDF = async () => {
     if (!containerRef.current) return;
     try {
       const html2canvas = (await import('html2canvas')).default;
       const { jsPDF } = await import('jspdf');
       const canvas = await html2canvas(containerRef.current);
       const imgData = canvas.toDataURL('image/png');
       const pdf = new jsPDF({
         orientation: 'landscape',
         unit: 'px',
         format: [canvas.width, canvas.height]
       });
       pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
       pdf.save(`Сесија_${new Date().toLocaleDateString('mk-MK')}.pdf`);
     } catch (e) {
       console.error("PDF Export error:", e);
       showToast(t('board.pdfFailed'), 'error');
     }
  };

  const saveSession = async () => {
     if (!auth.currentUser) return;
     setIsSaving(true);
     try {
       const payload = { strokes: board.strokes, latexBoxes: board.latexBoxes };
       if (sessionId) {
          await updateDoc(doc(db, 'whiteboard_sessions', sessionId), {
             ...payload,
             updatedAt: serverTimestamp()
          });
          showToast(t('board.sessionUpdated'), 'success');
       } else {
          const docRef = await addDoc(collection(db, 'whiteboard_sessions'), {
             roomId,
             title: t('board.sessionName', { date: new Date().toLocaleDateString('mk-MK') }),
             ...payload,
             authorId: auth.currentUser.uid,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp()
          });
          setSessionId(docRef.id);
          showToast(t('board.sessionSaved'), 'success');
       }
     } catch (e) {
       console.error("Save error:", e);
       showToast(t('board.sessionSaveFailed'), 'error');
     } finally {
       setIsSaving(false);
     }
  };

  // ─── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Variable-width strokes render as a few constant-width runs. Legacy strokes
   * (saved before this feature) carry no widths and keep their single line.
   */
  const renderedStrokes = useMemo(() => board.strokes.map(stroke => {
    // `tool` is authoritative; the colour check only covers pre-4.5 saved data.
    const isEraser = stroke.tool ? stroke.tool === 'eraser' : stroke.color === '#ffffff';
    const runs = stroke.widths?.length
      ? buildWidthRuns(fromFlatArray(stroke.points), stroke.widths)
      : [{ points: stroke.points, width: stroke.thickness }];
    return { id: stroke.id, color: stroke.color, isEraser, runs };
  }), [board.strokes]);

  return (
    <div className="flex flex-col w-full h-[600px] md:h-[700px] bg-slate-50 border border-slate-200 rounded-5xl overflow-hidden shadow-xl">
      <div className="bg-white px-6 py-4 flex flex-wrap items-center justify-between border-b gap-4 border-slate-200 shrink-0">
         <div className="flex items-center gap-4">
            <Button
               variant={tool === 'pen' ? 'default' : 'outline'}
               onClick={() => setTool('pen')}
               aria-label={t('board.pen')}
               aria-pressed={tool === 'pen'}
               title={t('board.pen')}
               className={`h-10 w-10 p-0 rounded-xl ${tool === 'pen' ? 'bg-indigo-600 shadow-md' : 'shadow-sm'}`}
            >
               <PenTool className="w-5 h-5" aria-hidden="true" />
            </Button>
            <Button
               variant={tool === 'eraser' ? 'default' : 'outline'}
               onClick={() => setTool('eraser')}
               aria-label={t('board.eraser')}
               aria-pressed={tool === 'eraser'}
               title={t('board.eraser')}
               className={`h-10 w-10 p-0 rounded-xl ${tool === 'eraser' ? 'bg-slate-800 shadow-md text-white' : 'shadow-sm text-slate-600'}`}
            >
               <Eraser className="w-5 h-5" aria-hidden="true" />
            </Button>

            <div className="flex items-center gap-2 px-3 border-l border-slate-200 ml-2">
               <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={!ownLastStroke}
                  aria-label={t('board.undo')}
                  title={t('board.undo')}
                  className="h-10 w-10 p-0 rounded-xl shadow-sm text-slate-600"
               >
                  <Undo2 className="w-5 h-5" aria-hidden="true" />
               </Button>
               <Button
                  variant="outline"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  aria-label={t('board.redo')}
                  title={t('board.redo')}
                  className="h-10 w-10 p-0 rounded-xl shadow-sm text-slate-600"
               >
                  <Redo2 className="w-5 h-5" aria-hidden="true" />
               </Button>
            </div>

            <div className="flex items-center gap-2 px-3 border-l border-slate-200 ml-2">
               {[
                 { value: '#4f46e5', className: 'bg-indigo-600', label: t('board.colorIndigo') },
                 { value: '#e11d48', className: 'bg-rose-600', label: t('board.colorRose') },
                 { value: '#16a34a', className: 'bg-green-600', label: t('board.colorGreen') },
                 { value: '#0f172a', className: 'bg-slate-900', label: t('board.colorDark') }
               ].map((swatch) => (
                 <button
                   type="button"
                   key={swatch.value}
                   onClick={() => { setColor(swatch.value); setTool('pen'); }}
                   aria-label={t('board.setColor', { color: swatch.label })}
                   title={t('board.setColor', { color: swatch.label })}
                   className={`w-7 h-7 rounded-full transition-transform shadow-sm ${swatch.className} ${color === swatch.value && tool === 'pen' ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                 />
               ))}
            </div>
         </div>
         <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
               <label htmlFor="shape-from-text" className="sr-only">{t('board.shapeFromText')}</label>
               <input
                 id="shape-from-text"
                 type="text"
                 value={shapeText}
                 onChange={(e) => setShapeText(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') insertShapeFromText(); }}
                 placeholder={t('board.shapePlaceholder')}
                 title={t('board.shapeHint')}
                 className="h-10 w-44 px-3 rounded-xl border border-slate-300 text-sm text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
               />
               <Button
                 onClick={insertShapeFromText}
                 disabled={!shapeText.trim()}
                 variant="outline"
                 aria-label={t('board.drawShape')}
                 title={t('board.drawShape')}
                 className="h-10 w-10 p-0 rounded-xl shadow-sm text-slate-600"
               >
                 <Shapes className="w-5 h-5" aria-hidden="true" />
               </Button>
             </div>
             {isTeacher && (
                <Button onClick={saveSession} disabled={isSaving} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm rounded-xl font-bold">
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Зачувај
                </Button>
             )}
             <div className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold font-mono tracking-widest rounded-lg border border-green-200 flex items-center shadow-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Во Живо
             </div>
             <Button
                onClick={exportToPDF}
                variant="outline"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 rounded-xl shadow-sm"
             >
                <Download className="w-4 h-4 mr-2" aria-hidden="true" /> PDF
             </Button>
             <Button
                onClick={recognizeInk}
                disabled={isRecognizing || board.strokes.length === 0}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-none rounded-xl font-bold shadow-sm"
             >
                <Brain className={`w-4 h-4 mr-2 ${isRecognizing ? 'animate-pulse' : ''}`} aria-hidden="true" />
                {isRecognizing ? 'Конвертирање...' : 'Ракопис -> LaTeX'}
             </Button>
             <Button onClick={clearCanvas} variant="outline" className="rounded-xl border-slate-300 text-slate-600 shadow-sm bg-white">
                Исчисти
             </Button>
         </div>
      </div>

      <div
        className="flex-1 w-full bg-white relative overflow-hidden touch-none select-none [overscroll-behavior:none]"
        ref={containerRef}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:30px_30px]" />

        {/* DOM HTML Overlays for LaTeX */}
        {board.latexBoxes.map(box => (
           <motion.div
              key={box.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              draggable
              onDragEnd={(e: any) => handleBoxDrag(box.id, e)}
              className="absolute z-10 cursor-move bg-white p-4 rounded-xl shadow-xl border border-indigo-100 pointer-events-auto"
              style={{ left: box.x, top: box.y }}
           >
              <MathRenderer
                content={box.kind === 'geometry'
                  ? `\`\`\`jsxgraph\n${box.text}\n\`\`\``
                  : `$$${box.text}$$`}
              />
           </motion.div>
        ))}

        <div className="w-full h-full cursor-crosshair touch-none">
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            ref={stageRef}
          >
            <Layer>
              {renderedStrokes.map(stroke =>
                stroke.runs.map((run, i) => (
                  <KonvaLine
                    key={`${stroke.id}-${i}`}
                    points={run.points}
                    stroke={stroke.color}
                    strokeWidth={run.width}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={stroke.isEraser ? 'destination-out' : 'source-over'}
                  />
                ))
              )}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
};

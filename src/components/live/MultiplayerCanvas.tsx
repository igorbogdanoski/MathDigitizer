import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Line as KonvaLine } from 'react-konva';
import { io, Socket } from 'socket.io-client';
import { Brain, Eraser, PenTool, ExternalLink, Type, Save, Loader2, Play, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { MathRenderer } from '../MathRenderer';
import { motion } from 'motion/react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  points: number[];
  color: string;
  thickness: number;
}

interface LatexBox {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface MultiplayerCanvasProps {
  roomId?: string;
  isTeacher?: boolean;
}

export const MultiplayerCanvas: React.FC<MultiplayerCanvasProps> = ({ 
  roomId = 'global-math-board', 
  isTeacher = false 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [latexBoxes, setLatexBoxes] = useState<LatexBox[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#4f46e5');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const sessionParam = params.get('session');
     if (sessionParam && !initialLoadDone) {
        setSessionId(sessionParam);
        getDoc(doc(db, 'whiteboard_sessions', sessionParam)).then(snap => {
           if (snap.exists()) {
              const data = snap.data();
              if (data.strokes) setStrokes(data.strokes);
              if (data.latexBoxes) setLatexBoxes(data.latexBoxes);
           }
        }).catch(err => console.error(err)).finally(() => setInitialLoadDone(true));
     } else {
        setInitialLoadDone(true);
     }
  }, [initialLoadDone]);

  useEffect(() => {
    // Connect to Socket
    const newSocket = io(window.location.protocol + '//' + window.location.host);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', roomId);
    });

    newSocket.on('canvas-event', (event: any) => {
      if (event.type === 'stroke:add') {
        setStrokes((prev) => [...prev, event.stroke]);
      } else if (event.type === 'stroke:clear') {
        setStrokes([]);
        setLatexBoxes([]);
      } else if (event.type === 'latex:add') {
        setLatexBoxes((prev) => [...prev, event.latex]);
      } else if (event.type === 'latex:move') {
        setLatexBoxes((prev) => prev.map(box => box.id === event.latex.id ? event.latex : box));
      }
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

  const emitEvent = (event: any) => {
    if (socket) {
      socket.emit('canvas-event', { roomId, event });
    }
  };

  const handlePointerDown = (e: any) => {
    // Only draw if clicking on the stage directly (not on DOM elements floating above)
    if (e.target.getClassName() !== 'Stage' && e.target.getClassName() !== 'Line') {
      return; // Handled by html overlay perhaps
    }
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const newStroke: Stroke = {
      id: Math.random().toString(36).substr(2, 9),
      points: [pos.x, pos.y],
      color: tool === 'eraser' ? '#ffffff' : color,
      thickness: tool === 'eraser' ? 20 : 3
    };
    setStrokes([...strokes, newStroke]);
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;
    
    let lastStroke = { ...strokes[strokes.length - 1] };
    lastStroke.points = lastStroke.points.concat([point.x, point.y]);
    
    setStrokes((prev) => {
      const idx = prev.length - 1;
      const newStrokes = [...prev];
      newStrokes[idx] = lastStroke;
      return newStrokes;
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const lastStroke = strokes[strokes.length - 1];
    if (lastStroke) {
      emitEvent({ type: 'stroke:add', stroke: lastStroke });
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setLatexBoxes([]);
    emitEvent({ type: 'stroke:clear' });
  };

  const recognizeInk = async () => {
    if (!stageRef.current) return;
    setIsRecognizing(true);
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 });
      const base64Data = dataUrl.split(',')[1];
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
           "Tease out ONLY the LaTeX formula from the handwriting on this whiteboard image. Do NOT include markdown backticks like ```latex . Return just the plain string.",
           {
              inlineData: {
                data: base64Data,
                mimeType: "image/png"
              }
           }
        ]
      });

      const latexContent = response.text?.trim() || "";
      if (latexContent) {
         const newBox: LatexBox = {
           id: Math.random().toString(36).substr(2, 9),
           text: latexContent,
           x: dimensions.width / 2 - 100,
           y: dimensions.height / 2
         };
         setLatexBoxes((prev) => [...prev, newBox]);
         emitEvent({ type: 'latex:add', latex: newBox });
         // Optional: Clear strokes after recognition to prevent clutter
         // setStrokes([]);
      }
    } catch (e) {
      console.error("Failed to recognize ink:", e);
      alert("Не успеавме да го препознаеме ракописот.");
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleBoxDrag = (id: string, e: React.DragEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 50; 
    const y = e.clientY - rect.top - 20;

    const updatedBox = latexBoxes.find(b => b.id === id);
    if (!updatedBox) return;
    updatedBox.x = x;
    updatedBox.y = y;

    setLatexBoxes(prev => prev.map(b => b.id === id ? updatedBox : b));
    emitEvent({ type: 'latex:move', latex: updatedBox });
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
       alert("Грешка при експортирање во PDF.");
     }
  };

  const saveSession = async () => {
     if (!auth.currentUser) return;
     setIsSaving(true);
     try {
       if (sessionId) {
          // Update
          await updateDoc(doc(db, 'whiteboard_sessions', sessionId), {
             strokes,
             latexBoxes,
             updatedAt: serverTimestamp()
          });
          alert("Сесијата е успешно ажурирана!");
       } else {
          // Create
          const docRef = await addDoc(collection(db, 'whiteboard_sessions'), {
             roomId,
             title: 'Сесија ' + new Date().toLocaleDateString('mk-MK'),
             strokes,
             latexBoxes,
             authorId: auth.currentUser.uid,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp()
          });
          setSessionId(docRef.id);
          alert("Сесијата е успешно зачувана трајно!");
       }
     } catch (e) {
       console.error("Save error:", e);
       alert("Грешка при зачувување на сесијата.");
     } finally {
       setIsSaving(false);
     }
  };

  return (
    <div className="flex flex-col w-full h-[600px] md:h-[700px] bg-slate-50 border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl">
      <div className="bg-white px-6 py-4 flex flex-wrap items-center justify-between border-b gap-4 border-slate-200 shrink-0">
         <div className="flex items-center gap-4">
            <Button 
               variant={tool === 'pen' ? 'default' : 'outline'}
               onClick={() => setTool('pen')}
               className={`h-10 w-10 p-0 rounded-xl ${tool === 'pen' ? 'bg-indigo-600 shadow-md' : 'shadow-sm'}`}
            >
               <PenTool className="w-5 h-5" />
            </Button>
            <Button 
               variant={tool === 'eraser' ? 'default' : 'outline'}
               onClick={() => setTool('eraser')}
               className={`h-10 w-10 p-0 rounded-xl ${tool === 'eraser' ? 'bg-slate-800 shadow-md text-white' : 'shadow-sm text-slate-600'}`}
            >
               <Eraser className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 px-3 border-l border-slate-200 ml-2">
               {['#4f46e5', '#e11d48', '#16a34a', '#0f172a'].map(c => (
                 <button 
                   key={c}
                   onClick={() => { setColor(c); setTool('pen'); }}
                   className={`w-7 h-7 rounded-full transition-transform shadow-sm ${color === c && tool === 'pen' ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                   style={{ backgroundColor: c }}
                 />
               ))}
            </div>
         </div>
         <div className="flex items-center gap-3">
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
                <Download className="w-4 h-4 mr-2" /> PDF
             </Button>
             <Button
                onClick={recognizeInk}
                disabled={isRecognizing || strokes.length === 0}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-none rounded-xl font-bold shadow-sm"
             >
                <Brain className={`w-4 h-4 mr-2 ${isRecognizing ? 'animate-pulse' : ''}`} />
                {isRecognizing ? 'Конвертирање...' : 'Ракопис -> LaTeX'}
             </Button>
             <Button onClick={clearCanvas} variant="outline" className="rounded-xl border-slate-300 text-slate-600 shadow-sm bg-white">
                Исчисти
             </Button>
         </div>
      </div>
      
      <div className="flex-1 w-full bg-white relative overflow-hidden" ref={containerRef}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }} />
        
        {/* DOM HTML Overlays for LaTeX */}
        {latexBoxes.map(box => (
           <motion.div
              key={box.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              draggable
              onDragEnd={(e: any) => handleBoxDrag(box.id, e)}
              className="absolute z-10 cursor-move bg-white p-4 rounded-xl shadow-xl border border-indigo-100 pointer-events-auto"
              style={{ left: box.x, top: box.y }}
           >
              <MathRenderer content={`$$${box.text}$$`} />
           </motion.div>
        ))}

        <div className="w-full h-full cursor-crosshair">
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={stageRef}
          >
            <Layer>
              {strokes.map(stroke => (
                <KonvaLine
                  key={stroke.id}
                  points={stroke.points}
                  stroke={stroke.color}
                  strokeWidth={stroke.thickness}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    stroke.color === '#ffffff' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
};


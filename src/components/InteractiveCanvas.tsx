import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Line, Rect, Circle, Arrow } from 'react-konva';
import { Eraser, RotateCcw, Send, PenTool, Square, Circle as CircleIcon, MoveRight, MousePointer2, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';

import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type ToolType = 'pen' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'select';

interface ShapeData {
  id: string;
  type: 'line' | 'rect' | 'circle' | 'arrow';
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
  isEraser?: boolean;
}

interface InteractiveCanvasProps {
  onSend: (base64Image: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  liveSyncId?: string;
  readOnly?: boolean;
  initialShapes?: ShapeData[];
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({ 
  onSend, 
  onCancel, 
  isSubmitting, 
  liveSyncId,
  readOnly = false,
  initialShapes = []
}) => {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#2563eb'); // Blue-600
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  const [shapes, setShapes] = useState<ShapeData[]>(initialShapes);
  const [currentShape, setCurrentShape] = useState<ShapeData | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sync to Firestore
  useEffect(() => {
    if (liveSyncId && !readOnly) {
      setDoc(doc(db, 'live_canvases', liveSyncId), { shapes });
    }
  }, [shapes, liveSyncId, readOnly]);

  // Read from Firestore (Spectator Mode)
  useEffect(() => {
    if (liveSyncId && readOnly) {
      const unsubscribe = onSnapshot(doc(db, 'live_canvases', liveSyncId), (docSnap) => {
        if (docSnap.exists() && docSnap.data().shapes) {
          setShapes(docSnap.data().shapes);
        }
      });
      return () => unsubscribe();
    }
  }, [liveSyncId, readOnly]);

  // Handle resize
  useEffect(() => {
    const checkSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const handleMouseDown = (e: any) => {
    if (readOnly) return;
    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
      }
      return;
    }

    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const id = Date.now().toString();

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentShape({
        id,
        type: 'line',
        points: [pos.x, pos.y],
        color: tool === 'eraser' ? '#ffffff' : color,
        strokeWidth: tool === 'eraser' ? 20 : strokeWidth,
        isEraser: tool === 'eraser'
      });
    } else if (tool === 'rect') {
      setCurrentShape({
        id,
        type: 'rect',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color,
        strokeWidth
      });
    } else if (tool === 'circle') {
      setCurrentShape({
        id,
        type: 'circle',
        x: pos.x,
        y: pos.y,
        radius: 0,
        color,
        strokeWidth
      });
    } else if (tool === 'arrow') {
      setCurrentShape({
        id,
        type: 'arrow',
        points: [pos.x, pos.y, pos.x, pos.y],
        color,
        strokeWidth
      });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentShape) return;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (currentShape.type === 'line') {
      setCurrentShape({
        ...currentShape,
        points: [...(currentShape.points || []), pos.x, pos.y]
      });
    } else if (currentShape.type === 'rect') {
      setCurrentShape({
        ...currentShape,
        width: pos.x - (currentShape.x || 0),
        height: pos.y - (currentShape.y || 0)
      });
    } else if (currentShape.type === 'circle') {
      const dx = pos.x - (currentShape.x || 0);
      const dy = pos.y - (currentShape.y || 0);
      setCurrentShape({
        ...currentShape,
        radius: Math.sqrt(dx * dx + dy * dy)
      });
    } else if (currentShape.type === 'arrow') {
      setCurrentShape({
        ...currentShape,
        points: [currentShape.points![0], currentShape.points![1], pos.x, pos.y]
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);
    setShapes([...shapes, currentShape]);
    setCurrentShape(null);
  };

  const handleUndo = () => {
    setShapes(shapes.slice(0, -1));
    setSelectedId(null);
  };

  const handleClear = () => {
    if (window.confirm('Дали сте сигурни дека сакате да го избришете целиот канвас?')) {
      setShapes([]);
      setSelectedId(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
      setShapes(shapes.filter(s => s.id !== selectedId));
      setSelectedId(null);
    }
  };

  const handleSend = () => {
    if (!stageRef.current) return;
    
    // Deselect before taking screenshot
    setSelectedId(null);
    
    setTimeout(() => {
      // Get data URL from Konva stage
      const dataUrl = stageRef.current.toDataURL({
        pixelRatio: 2, // High quality
        mimeType: 'image/jpeg',
        quality: 0.9,
        backgroundColor: '#ffffff'
      });
      
      const base64 = dataUrl.split(',')[1];
      onSend(base64);
    }, 50);
  };

  const colors = ['#000000', '#ef4444', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      {/* Toolbar */}
      {!readOnly && (
      <div className="flex flex-wrap items-center justify-between p-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 gap-2">
        
        {/* Tools */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <button onClick={() => setTool('select')} aria-label={t('ariaSelect')} className={`p-1.5 rounded-md transition-colors ${tool === 'select' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaSelect')}>
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button onClick={() => setTool('pen')} aria-label={t('ariaPen')} className={`p-1.5 rounded-md transition-colors ${tool === 'pen' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaPen')}>
            <PenTool className="w-4 h-4" />
          </button>
          <button onClick={() => setTool('eraser')} aria-label={t('ariaEraser')} className={`p-1.5 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaEraser')}>
            <Eraser className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
          <button onClick={() => setTool('rect')} aria-label={t('ariaRectangle')} className={`p-1.5 rounded-md transition-colors ${tool === 'rect' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaRectangle')}>
            <Square className="w-4 h-4" />
          </button>
          <button onClick={() => setTool('circle')} aria-label={t('ariaCircle')} className={`p-1.5 rounded-md transition-colors ${tool === 'circle' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaCircle')}>
            <CircleIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setTool('arrow')} aria-label={t('ariaArrow')} className={`p-1.5 rounded-md transition-colors ${tool === 'arrow' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title={t('ariaArrow')}>
            <MoveRight className="w-4 h-4" />
          </button>
        </div>

        {/* Colors & Width */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Боја: ${c}`}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-slate-400' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c }}
                title={t('ariaColor')}
              />
            ))}
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={strokeWidth} 
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-20 accent-indigo-600"
            title={t('ariaLineThickness')}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedId && (
            <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="h-8 px-2 text-red-500 hover:bg-red-50" title={t('ariaDeleteSelected')}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleUndo} disabled={shapes.length === 0 || isSubmitting} className="h-8 px-2 text-slate-500 hover:text-slate-700" title={t('ariaUndo')}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={shapes.length === 0 || isSubmitting} className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" title={t('ariaClearAll')}>
            Избриши
          </Button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting} className="h-8 px-3 text-slate-500">
            Откажи
          </Button>
          <Button size="sm" onClick={handleSend} disabled={shapes.length === 0 || isSubmitting} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Send className="w-3 h-3 mr-1.5" />
            Испрати
          </Button>
        </div>
      </div>
      )}
      
      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 relative bg-white touch-none"
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            ref={stageRef}
          >
            <Layer>
              {/* Background to ensure white export */}
              <Rect
                x={0}
                y={0}
                width={dimensions.width}
                height={dimensions.height}
                fill="#ffffff"
              />
              
              {shapes.map((shape) => (
                <React.Fragment key={shape.id}>
                  {shape.type === 'line' && (
                    <Line
                      points={shape.points}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={shape.isEraser ? 'destination-out' : 'source-over'}
                      draggable={tool === 'select' && !shape.isEraser}
                      onClick={() => tool === 'select' && setSelectedId(shape.id)}
                      onTap={() => tool === 'select' && setSelectedId(shape.id)}
                      strokeScaleEnabled={false}
                      shadowColor={selectedId === shape.id ? '#3b82f6' : 'transparent'}
                      shadowBlur={selectedId === shape.id ? 5 : 0}
                    />
                  )}
                  {shape.type === 'rect' && (
                    <Rect
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(shape.id)}
                      onTap={() => tool === 'select' && setSelectedId(shape.id)}
                      shadowColor={selectedId === shape.id ? '#3b82f6' : 'transparent'}
                      shadowBlur={selectedId === shape.id ? 5 : 0}
                    />
                  )}
                  {shape.type === 'circle' && (
                    <Circle
                      x={shape.x}
                      y={shape.y}
                      radius={shape.radius}
                      stroke={shape.color}
                      strokeWidth={shape.strokeWidth}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(shape.id)}
                      onTap={() => tool === 'select' && setSelectedId(shape.id)}
                      shadowColor={selectedId === shape.id ? '#3b82f6' : 'transparent'}
                      shadowBlur={selectedId === shape.id ? 5 : 0}
                    />
                  )}
                  {shape.type === 'arrow' && (
                    <Arrow
                      points={shape.points || []}
                      stroke={shape.color}
                      fill={shape.color}
                      strokeWidth={shape.strokeWidth}
                      pointerLength={shape.strokeWidth * 3}
                      pointerWidth={shape.strokeWidth * 3}
                      draggable={tool === 'select'}
                      onClick={() => tool === 'select' && setSelectedId(shape.id)}
                      onTap={() => tool === 'select' && setSelectedId(shape.id)}
                      shadowColor={selectedId === shape.id ? '#3b82f6' : 'transparent'}
                      shadowBlur={selectedId === shape.id ? 5 : 0}
                    />
                  )}
                </React.Fragment>
              ))}
              
              {/* Current Shape being drawn */}
              {currentShape && (
                <React.Fragment>
                  {currentShape.type === 'line' && (
                    <Line
                      points={currentShape.points}
                      stroke={currentShape.color}
                      strokeWidth={currentShape.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={currentShape.isEraser ? 'destination-out' : 'source-over'}
                    />
                  )}
                  {currentShape.type === 'rect' && (
                    <Rect
                      x={currentShape.x}
                      y={currentShape.y}
                      width={currentShape.width}
                      height={currentShape.height}
                      stroke={currentShape.color}
                      strokeWidth={currentShape.strokeWidth}
                    />
                  )}
                  {currentShape.type === 'circle' && (
                    <Circle
                      x={currentShape.x}
                      y={currentShape.y}
                      radius={currentShape.radius}
                      stroke={currentShape.color}
                      strokeWidth={currentShape.strokeWidth}
                    />
                  )}
                  {currentShape.type === 'arrow' && (
                    <Arrow
                      points={currentShape.points || []}
                      stroke={currentShape.color}
                      fill={currentShape.color}
                      strokeWidth={currentShape.strokeWidth}
                      pointerLength={currentShape.strokeWidth * 3}
                      pointerWidth={currentShape.strokeWidth * 3}
                    />
                  )}
                </React.Fragment>
              )}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
};

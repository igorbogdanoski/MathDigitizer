import { useState, useRef, useEffect } from 'react';
import { X, Minimize2, Activity, PenTool, MousePointer2, Play } from 'lucide-react';
import { Button } from './ui/Button';

interface GeoGebraViewerProps {
  commands: string[];
  onClose?: () => void;
  inline?: boolean;
}

export function GeoGebraViewer({ commands, onClose, inline = false }: GeoGebraViewerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [tool, setTool] = useState<'move' | 'pen'>('move');
  const [color, setColor] = useState('#2563eb');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const postMsg = (msg: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    }
  };

  const handleExecute = () => {
    if (!cmdInput.trim()) return;
    postMsg({ type: 'evalCommand', command: cmdInput });
    setCmdInput('');
  };

  useEffect(() => {
    postMsg({ type: 'setMode', mode: tool === 'pen' ? 62 : 0 });
  }, [tool]);

  useEffect(() => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    postMsg({ type: 'setPenColor', r, g, b });
  }, [color]);

  useEffect(() => {
    postMsg({ type: 'setPenSize', size: strokeWidth * 2 }); // Scale for GeoGebra
  }, [strokeWidth]);

  if (isMinimized && !inline) {
    return (
      <div className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[100] cursor-pointer hover:bg-slate-800 transition-all border border-slate-700 animate-in slide-in-from-bottom-5" onClick={() => setIsMinimized(false)}>
        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
          <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm">GeoGebra е активна</span>
          <span className="text-xs text-slate-400">Кликни за да се вратиш</span>
        </div>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (onClose) onClose();
          }} 
          className="ml-2 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-slate-400 hover:text-white" />
        </button>
      </div>
    );
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body { margin: 0; padding: 0; overflow: hidden; background: #ffffff; }</style>
        <script src="https://www.geogebra.org/apps/deployggb.js"></script>
    </head>
    <body>
        <div id="ggb-element"></div>
        <script>
            function handleUpdate(objName) {
                if (window.ggbApplet) {
                   var x = window.ggbApplet.getXcoord(objName);
                   var y = window.ggbApplet.getYcoord(objName);
                   window.parent.postMessage({ type: 'geogebra_update', objName: objName, x: x, y: y }, '*');
                }
            }

            var params = {
                "appName": "classic",
                "width": ${inline ? 'window.innerWidth - 20' : 'window.innerWidth'}, 
                "height": ${inline ? 'window.innerHeight - 20' : 'window.innerHeight'}, 
                "showToolBar": true, 
                "showAlgebraInput": true, 
                "showMenuBar": true,
                "useBrowserForJS": false,
                "appletOnLoad": function(api) {
                    api.registerUpdateListener("handleUpdate");
                    var cmds = ${JSON.stringify(commands)};
                    setTimeout(function() {
                        cmds.forEach(function(cmd) {
                            try {
                                api.evalCommand(cmd);
                            } catch (e) {
                                console.error("GeoGebra Command Error:", cmd, e);
                            }
                        });
                    }, 500);
                }
            };
            var applet = new GGBApplet(params, true);
            window.addEventListener("load", function() {
                applet.inject('ggb-element');
            });
            window.addEventListener("resize", function() {
                if (window.ggbApplet) {
                    window.ggbApplet.setSize(window.innerWidth, window.innerHeight);
                }
            });
            window.addEventListener("message", function(event) {
                if (!window.ggbApplet || !event.data) return;
                var data = event.data;
                if (data.type === 'evalCommand') {
                    window.ggbApplet.evalCommand(data.command);
                } else if (data.type === 'setMode') {
                    window.ggbApplet.setMode(data.mode);
                } else if (data.type === 'setPenColor') {
                    window.ggbApplet.setPenColor(data.r, data.g, data.b);
                } else if (data.type === 'setPenSize') {
                    window.ggbApplet.setPenSize(data.size);
                }
            });
        </script>
    </body>
    </html>
  `;

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-100 border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
          <button onClick={() => setTool('move')} className={`p-1.5 rounded-md transition-colors ${tool === 'move' ? 'bg-slate-100 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Селектирај">
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button onClick={() => setTool('pen')} className={`p-1.5 rounded-md transition-colors ${tool === 'pen' ? 'bg-slate-100 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="Цртање со рака">
            <PenTool className="w-4 h-4" />
          </button>
      </div>

      {tool === 'pen' && (
        <div className="flex items-center gap-3 bg-white p-1 px-3 rounded-lg border border-slate-200">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer" title="Боја на маркер" />
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <input 
              type="range" 
              min="1" max="10" 
              value={strokeWidth} 
              onChange={e => setStrokeWidth(parseInt(e.target.value))}
              className="w-20 accent-indigo-600 cursor-pointer"
              title="Дебелина на линија"
            />
        </div>
      )}

      <div className="flex flex-1 items-center gap-2">
        <input 
          type="text" 
          placeholder="Внеси GeoGebra команда динамично (пр. y = a x^2)..." 
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 text-black shadow-sm"
        />
        <Button size="sm" onClick={handleExecute} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
          <Play className="w-4 h-4 mr-1" />
          Изврши
        </Button>
      </div>
    </div>
  );

  if (inline) {
    return (
       <div className="w-full h-full relative bg-slate-50 flex flex-col border border-slate-200 rounded-xl overflow-hidden">
         {renderToolbar()}
         <div className="flex-1 relative">
           <iframe
             ref={iframeRef}
             srcDoc={htmlContent}
             className="w-full h-full border-none absolute inset-0"
             title="GeoGebra Interactive Viewer"
             sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
           />
         </div>
       </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in zoom-in duration-300 shadow-2xl">
      {/* Header Toolbar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold font-display tracking-tight text-slate-100">MathDigitizer Pro <span className="text-slate-500 mx-2">|</span> GeoGebra Интерактивно Платно</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(true)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-300 hover:text-white" title="Минимизирај">
            <Minimize2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Минимизирај</span>
          </button>
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <button onClick={onClose} className="p-2 hover:bg-rose-500/20 rounded-lg transition-colors text-slate-300 hover:text-rose-400" title="Затвори целосно">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {renderToolbar()}

      {/* Iframe Container */}
      <div className="flex-1 w-full h-full relative bg-slate-50">
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-none absolute inset-0"
          title="GeoGebra Interactive Viewer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
}

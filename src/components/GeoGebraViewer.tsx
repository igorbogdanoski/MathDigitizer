import { useState } from 'react';
import { X, Minimize2, Activity } from 'lucide-react';

interface GeoGebraViewerProps {
  commands: string[];
  onClose?: () => void;
  inline?: boolean;
}

export function GeoGebraViewer({ commands, onClose, inline = false }: GeoGebraViewerProps) {
  const [isMinimized, setIsMinimized] = useState(false);

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
                "appName": "geometry", 
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
        </script>
    </body>
    </html>
  `;

  if (inline) {
    return (
       <div className="w-full h-full relative bg-slate-50">
         <iframe
           srcDoc={htmlContent}
           className="w-full h-full border-none absolute inset-0 rounded-xl"
           title="GeoGebra Interactive Viewer"
           sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
         />
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
      
      {/* Iframe Container */}
      <div className="flex-1 w-full h-full relative bg-slate-50">
        <iframe
          srcDoc={htmlContent}
          className="w-full h-full border-none absolute inset-0"
          title="GeoGebra Interactive Viewer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        />
      </div>
    </div>
  );
}

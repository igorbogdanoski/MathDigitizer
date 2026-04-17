import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from './ui/Button';

export const ReloadPrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-4 max-w-sm w-full flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {offlineReady ? 'Апликацијата е подготвена' : 'Достапно е ажурирање'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {offlineReady 
                ? 'Апликацијата сега може да работи без интернет конекција.' 
                : 'Нова верзија на апликацијата е достапна. Кликнете за да ажурирате.'}
            </p>
          </div>
          <button 
            onClick={close}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={close}>
            Затвори
          </Button>
          {needRefresh && (
            <Button 
              size="sm" 
              onClick={() => updateServiceWorker(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Ажурирај
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

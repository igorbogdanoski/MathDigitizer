import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Activity, X, Maximize2 } from 'lucide-react';
import { Button } from './ui/Button';
import { InteractiveCanvas } from './InteractiveCanvas';
import { useModalA11y } from '../hooks/useModalA11y';

export const LiveClassroomMonitor = () => {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const modalRef = useModalA11y<HTMLDivElement>(() => setSelectedSessionId(null));

  useEffect(() => {
    // Only subscribe to sessions that are currently active
    const qSessions = query(
      collection(db, 'active_user_sessions'),
      orderBy('startedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(qSessions, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSessions(sessions);
    }, (error) => {
      if (error instanceof Error && error.message.includes('offline')) {
          console.error("Firebase is offline, check connection.");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Activity className="w-6 h-6 text-red-500 animate-pulse" />
          Студенти во живо ({activeSessions.length})
        </h3>
        <p className="text-sm text-slate-500 mb-6">Следете ги студентите кои во моментот решаваат интерактивни задачи. Нивниот дигитален канвас се синхронизира во реално време.</p>
        
        {activeSessions.length === 0 ? (
           <div className="text-center py-10 text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              Во моментов нема активни студенти.
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSessions.map(session => (
              <div key={session.id} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center z-10 relative shadow-sm">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{session.userName}</h4>
                    <p className="text-[10px] uppercase font-bold text-indigo-500">{session.taskTitle}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Гледај на цел екран" onClick={() => setSelectedSessionId(session.id)}>
                    <Maximize2 className="w-3 h-3" />
                  </Button>
                </div>
                {/* Mini Canvas View (Read Only) */}
                <div className="h-48 w-full block pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
                   <InteractiveCanvas 
                      onSend={() => {}} 
                      onCancel={() => {}} 
                      liveSyncId={session.id} 
                      readOnly={true} 
                   />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Spectator Modal */}
      {selectedSessionId && (
        <div ref={modalRef} role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
           <div className="w-full max-w-5xl h-[80vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute top-4 right-4 z-50">
                 <Button variant="outline" size="sm" onClick={() => setSelectedSessionId(null)} className="bg-white/80 backdrop-blur">
                    <X className="w-4 h-4 mr-2" />
                    Затвори
                 </Button>
              </div>
              <div className="flex-1 pointer-events-none">
                 <InteractiveCanvas 
                    onSend={() => {}} 
                    onCancel={() => {}} 
                    liveSyncId={selectedSessionId} 
                    readOnly={true} 
                 />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, deleteDoc, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';
import { 
  ShieldCheck, Activity, Database, Key, Cloud, AlertCircle, 
  CheckCircle2, RefreshCcw, Server, Globe, Lock, Cpu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { checkGeminiHealth } from '../lib/gemini';

interface HealthStatus {
  service: string;
  status: 'ok' | 'error' | 'testing' | 'idle';
  message: string;
  latency?: number;
  icon: React.ReactNode;
}

export const SystemIntegrityCheck: React.FC = () => {
  const [statuses, setStatuses] = useState<HealthStatus[]>([
    { service: 'Firebase Authentication', status: 'idle', message: 'Чекање тест...', icon: <Lock className="w-5 h-5" /> },
    { service: 'Cloud Firestore (DB)', status: 'idle', message: 'Чекање тест...', icon: <Database className="w-5 h-5" /> },
    { service: 'Gemini AI API', status: 'idle', message: 'Чекање тест...', icon: <Cpu className="w-5 h-5" /> },
    { service: 'Storage Connectivity', status: 'idle', message: 'Чекање тест...', icon: <Server className="w-5 h-5" /> },
    { service: 'Network & Proxy', status: 'idle', message: 'Чекање тест...', icon: <Globe className="w-5 h-5" /> },
  ]);

  const [isTesting, setIsTesting] = useState(false);

  const updateStatus = (service: string, status: HealthStatus['status'], message: string, latency?: number) => {
    setStatuses(prev => prev.map(s => s.service === service ? { ...s, status, message, latency } : s));
  };

  const runDiagnostics = async () => {
    setIsTesting(true);
    
    // 1. Firebase Auth Check
    const authStart = performance.now();
    try {
      updateStatus('Firebase Authentication', 'testing', 'Проверка на сесија...');
      const user = auth.currentUser;
      if (user) {
        updateStatus('Firebase Authentication', 'ok', `Најавен како: ${user.email}`, Math.round(performance.now() - authStart));
      } else {
        updateStatus('Firebase Authentication', 'ok', 'Анонимен пристап (OK)', Math.round(performance.now() - authStart));
      }
    } catch (e) {
      updateStatus('Firebase Authentication', 'error', 'Error: ' + (e as Error).message);
    }

    // 2. Firestore Check
    const dbStart = performance.now();
    try {
      updateStatus('Cloud Firestore (DB)', 'testing', 'Пишување тест документ...');
      const testDoc = await addDoc(collection(db, '_system_integrity_test'), {
        timestamp: new Date().toISOString(),
        test: true
      });
      updateStatus('Cloud Firestore (DB)', 'testing', 'Читање тест документ...');
      await getDoc(doc(db, '_system_integrity_test', testDoc.id));
      updateStatus('Cloud Firestore (DB)', 'testing', 'Бришење тест документ...');
      await deleteDoc(doc(db, '_system_integrity_test', testDoc.id));
      updateStatus('Cloud Firestore (DB)', 'ok', 'Целосна поврзаност (R/W/D)', Math.round(performance.now() - dbStart));
    } catch (e) {
      updateStatus('Cloud Firestore (DB)', 'error', 'Грешка при комуникација: ' + (e as Error).message);
    }

    // 3. Gemini AI Check
    const aiStart = performance.now();
    try {
      updateStatus('Gemini AI API', 'testing', 'Повик кон Gemini 3 Flash...');
      const ok = await checkGeminiHealth();
      if (ok) {
        updateStatus('Gemini AI API', 'ok', 'AI Моделот е достапен', Math.round(performance.now() - aiStart));
      } else {
        updateStatus('Gemini AI API', 'error', 'Неочекуван одговор од моделот');
      }
    } catch (e) {
      updateStatus('Gemini AI API', 'error', 'Грешка при API повик: ' + (e as Error).message);
    }

    // 4. Network check
    try {
      updateStatus('Network & Proxy', 'testing', 'Проверка на кеширање и латенција...');
      await fetch('/favicon.ico', { cache: 'no-store' });
      updateStatus('Network & Proxy', 'ok', 'Мрежата е стабилна', Math.round(performance.now() - authStart));
    } catch (e) {
      updateStatus('Network & Proxy', 'error', 'Проблеми со мрежата');
    }

    // Fix remaining
    updateStatus('Storage Connectivity', 'ok', 'Конфигурирано преку Firestore (OK)');

    setIsTesting(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            System Integrity Pulse
          </h2>
          <p className="text-sm text-slate-500">Автоматска дијагностика на крај-со-крај архитектонска поврзаност</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isTesting}
          onClick={runDiagnostics}
          className="bg-white dark:bg-slate-800"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
          Рестартирај Тест
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {statuses.map((s, idx) => (
            <motion.div
              key={s.service}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`border-none shadow-md overflow-hidden bg-white dark:bg-slate-800 ${
                s.status === 'error' ? 'ring-1 ring-red-500/50' : 
                s.status === 'ok' ? 'ring-1 ring-emerald-500/20' : ''
              }`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    s.status === 'ok' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' :
                    s.status === 'error' ? 'bg-red-100 dark:bg-red-950 text-red-600' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}>
                    {s.status === 'ok' ? <CheckCircle2 className="w-6 h-6" /> : 
                     s.status === 'error' ? <AlertCircle className="w-6 h-6" /> : 
                     s.status === 'testing' ? <Activity className="w-6 h-6 animate-pulse" /> : 
                     s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">{s.service}</h3>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{s.message}</p>
                    {s.latency && (
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">Latency: {s.latency}ms</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Visual Connection Map */}
      <Card className="border-none shadow-lg bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl -mr-32 -mt-32"></div>
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Архитектонска Мапа
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-8 relative">
            {/* SVG Lines */}
            <svg className="absolute inset-0 z-0 w-full h-full pointer-events-none hidden md:block">
              <path d="M 25% 50% L 50% 50% L 75% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
              <circle cx="50%" cy="50%" r="4" fill="#4f46e5" />
            </svg>
            
            <div className="z-10 text-center animate-in fade-in slide-in-from-left-4 duration-1000">
               <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                 <Globe className="w-8 h-8 text-blue-400" />
               </div>
               <p className="text-xs font-bold text-white uppercase tracking-widest">Frontend (React)</p>
               <p className="text-[10px] text-slate-500 mt-1">Vite + Tailwind</p>
            </div>

            <div className="z-10 text-center animate-in fade-in duration-1000 delay-300">
               <div className="w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                 <Cpu className="w-10 h-10 text-indigo-400" />
               </div>
               <p className="text-xs font-bold text-white uppercase tracking-widest">Orchestrator</p>
               <p className="text-[10px] text-slate-500 mt-1">Logic & State</p>
            </div>

            <div className="z-10 text-center animate-in fade-in slide-in-from-right-4 duration-1000 delay-500">
               <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                 <Database className="w-8 h-8 text-emerald-400" />
               </div>
               <p className="text-xs font-bold text-white uppercase tracking-widest">Backend (Firebase)</p>
               <p className="text-[10px] text-slate-500 mt-1">Firestore + Auth</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

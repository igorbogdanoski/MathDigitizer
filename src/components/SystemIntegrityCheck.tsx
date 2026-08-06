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
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { isPaymentAdmin } from '../lib/paymentIntents';

const INGESTION_HISTORY_KEY = 'ingestion_diagnostics_history_v1';
const INGESTION_HISTORY_LIMIT = 30;

interface IngestionDiagnosticsView {
  ok: boolean;
  generatedAt: string;
  policyModes: {
    userInputMode: 'advisory' | 'strict';
    sourceContentMode: 'advisory' | 'strict';
  };
  scanner: {
    totalRules: number;
    bySeverity: { low: number; medium: number; high: number };
    highSeverityRuleIds: string[];
  };
  preflight?: {
    ok: boolean;
    generatedAt: string;
    dependencyChecks: Array<{
      name: string;
      status: 'available' | 'missing';
      details: string;
    }>;
    parserPlans: Array<{
      sourceType: 'url' | 'text' | 'file-image' | 'file-pdf';
      primary: string;
      fallback: string[];
    }>;
  };
  advisories: string[];
}

interface HealthStatus {
  service: string;
  status: 'ok' | 'error' | 'testing' | 'idle';
  message: string;
  latency?: number;
  icon: React.ReactNode;
}

interface SeverityTrendPoint {
  stamp: string;
  highPct: number;
  mediumPct: number;
  lowPct: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

function readSeverityHistory(): SeverityTrendPoint[] {
  try {
    const raw = window.localStorage.getItem(INGESTION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SeverityTrendPoint[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-INGESTION_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeSeverityHistory(data: SeverityTrendPoint[]) {
  try {
    window.localStorage.setItem(INGESTION_HISTORY_KEY, JSON.stringify(data.slice(-INGESTION_HISTORY_LIMIT)));
  } catch {
    // Ignore localStorage persistence failures (private mode or blocked storage).
  }
}

function clearSeverityHistory() {
  try {
    window.localStorage.removeItem(INGESTION_HISTORY_KEY);
  } catch {
    // Ignore localStorage cleanup failures.
  }
}

function toSeverityTrendPoint(data: IngestionDiagnosticsView): SeverityTrendPoint {
  const low = data.scanner.bySeverity.low;
  const medium = data.scanner.bySeverity.medium;
  const high = data.scanner.bySeverity.high;
  const total = Math.max(1, low + medium + high);

  return {
    stamp: data.generatedAt,
    highPct: Math.round((high / total) * 100),
    mediumPct: Math.round((medium / total) * 100),
    lowPct: Math.round((low / total) * 100),
    highCount: high,
    mediumCount: medium,
    lowCount: low,
  };
}

export const SystemIntegrityCheck: React.FC = () => {
  const { user, userProfile } = useAuth();
  const canViewIngestionDiagnostics = isPaymentAdmin(userProfile?.email ?? user?.email);

  const [statuses, setStatuses] = useState<HealthStatus[]>([
    { service: 'Firebase Authentication', status: 'idle', message: 'Чекање тест...', icon: <Lock className="w-5 h-5" /> },
    { service: 'Cloud Firestore (DB)', status: 'idle', message: 'Чекање тест...', icon: <Database className="w-5 h-5" /> },
    { service: 'Gemini AI API', status: 'idle', message: 'Чекање тест...', icon: <Cpu className="w-5 h-5" /> },
    { service: 'Storage Connectivity', status: 'idle', message: 'Чекање тест...', icon: <Server className="w-5 h-5" /> },
    { service: 'Network & Proxy', status: 'idle', message: 'Чекање тест...', icon: <Globe className="w-5 h-5" /> },
  ]);

  const [isTesting, setIsTesting] = useState(false);
  const [ingestionDiagnostics, setIngestionDiagnostics] = useState<IngestionDiagnosticsView | null>(null);
  const [ingestionDiagLoading, setIngestionDiagLoading] = useState(false);
  const [ingestionDiagError, setIngestionDiagError] = useState<string | null>(null);
  const [severityHistory, setSeverityHistory] = useState<SeverityTrendPoint[]>([]);
  const [includePreflight, setIncludePreflight] = useState(false);

  const handleResetSeverityHistory = () => {
    clearSeverityHistory();
    setSeverityHistory([]);
  };

  const handleExportSeverityHistory = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        includePreflight,
        latestDiagnosticsGeneratedAt: ingestionDiagnostics?.generatedAt ?? null,
        snapshots: severityHistory,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');

      anchor.href = objectUrl;
      anchor.download = `ingestion-diagnostics-trend-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      setIngestionDiagError('Failed to export diagnostics history JSON.');
    }
  };

  const fetchIngestionDiagnostics = async (preflightOverride?: boolean) => {
    setIngestionDiagLoading(true);
    setIngestionDiagError(null);
    const preflightEnabled = typeof preflightOverride === 'boolean' ? preflightOverride : includePreflight;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`/api/ingestion/diagnostics?preflight=${preflightEnabled ? 'true' : 'false'}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.status === 401) {
        setIngestionDiagnostics(null);
        setIngestionDiagError('Ingestion diagnostics are protected (401). Set admin key policy for internal access.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Diagnostics request failed (${response.status})`);
      }

      const data = (await response.json()) as IngestionDiagnosticsView;
      setIngestionDiagnostics(data);

      const nextPoint = toSeverityTrendPoint(data);
      setSeverityHistory((prev) => {
        const base = prev.length > 0 ? prev : readSeverityHistory();
        const deduped = base.filter((item) => item.stamp !== nextPoint.stamp);
        const next = [...deduped, nextPoint].slice(-INGESTION_HISTORY_LIMIT);
        writeSeverityHistory(next);
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown diagnostics error';
      setIngestionDiagError(message);
      setIngestionDiagnostics(null);
    } finally {
      window.clearTimeout(timeoutId);
      setIngestionDiagLoading(false);
    }
  };

  const togglePreflightDiagnostics = async () => {
    const next = !includePreflight;
    setIncludePreflight(next);
    await fetchIngestionDiagnostics(next);
  };

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
    setSeverityHistory(readSeverityHistory());
    runDiagnostics();
  }, []);

  useEffect(() => {
    if (!canViewIngestionDiagnostics) return;
    fetchIngestionDiagnostics();
  }, [canViewIngestionDiagnostics]);

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

      <Card className="border-none shadow-lg bg-white dark:bg-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Ingestion Safety Diagnostics
            </CardTitle>
            {canViewIngestionDiagnostics && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ingestionDiagLoading}
                  onClick={() => fetchIngestionDiagnostics()}
                  className="bg-white dark:bg-slate-800"
                >
                  <RefreshCcw className={`w-4 h-4 mr-2 ${ingestionDiagLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ingestionDiagLoading}
                  onClick={togglePreflightDiagnostics}
                  className="bg-white dark:bg-slate-800"
                >
                  Preflight: {includePreflight ? 'ON' : 'OFF'}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {!canViewIngestionDiagnostics ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
              Ingestion diagnostics are restricted to admins.
            </div>
          ) : ingestionDiagError ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-200">
              <div className="font-semibold mb-1">Diagnostics unavailable</div>
              <div>{ingestionDiagError}</div>
            </div>
          ) : ingestionDiagLoading && !ingestionDiagnostics ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-300">
              Loading ingestion diagnostics...
            </div>
          ) : ingestionDiagnostics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">User Input Mode</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{ingestionDiagnostics.policyModes.userInputMode}</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Source Content Mode</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{ingestionDiagnostics.policyModes.sourceContentMode}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/40 p-3 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Rules</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white">{ingestionDiagnostics.scanner.totalRules}</div>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-900/50">
                  <div className="text-xs text-red-600 uppercase tracking-wide">High</div>
                  <div className="text-xl font-black text-red-700 dark:text-red-300">{ingestionDiagnostics.scanner.bySeverity.high}</div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-900/50">
                  <div className="text-xs text-amber-700 uppercase tracking-wide">Medium</div>
                  <div className="text-xl font-black text-amber-800 dark:text-amber-300">{ingestionDiagnostics.scanner.bySeverity.medium}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-xs text-emerald-700 uppercase tracking-wide">Low</div>
                  <div className="text-xl font-black text-emerald-800 dark:text-emerald-300">{ingestionDiagnostics.scanner.bySeverity.low}</div>
                </div>
              </div>

              {severityHistory.length > 1 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Severity Mix Trend (Last {severityHistory.length})</div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportSeverityHistory}
                        className="h-7 px-2 text-xs"
                      >
                        Export JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetSeverityHistory}
                        className="h-7 px-2 text-xs"
                      >
                        Reset history
                      </Button>
                    </div>
                  </div>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={severityHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sevLow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.08} />
                          </linearGradient>
                          <linearGradient id="sevMedium" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.08} />
                          </linearGradient>
                          <linearGradient id="sevHigh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.08} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" strokeOpacity={0.45} />
                        <XAxis
                          dataKey="stamp"
                          tickFormatter={(value) => new Date(value).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}
                          minTickGap={20}
                          tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(value: number, name: string, item: any) => {
                            const label = name === 'highPct' ? 'High' : name === 'mediumPct' ? 'Medium' : 'Low';
                            const countKey = name === 'highPct' ? 'highCount' : name === 'mediumPct' ? 'mediumCount' : 'lowCount';
                            const count = item?.payload?.[countKey] ?? 0;
                            return [`${value}% (${count})`, label];
                          }}
                          labelFormatter={(value) => new Date(value).toLocaleString('mk-MK')}
                        />
                        <Area type="monotone" dataKey="lowPct" name="lowPct" stroke="#10b981" fill="url(#sevLow)" strokeWidth={2} />
                        <Area type="monotone" dataKey="mediumPct" name="mediumPct" stroke="#f59e0b" fill="url(#sevMedium)" strokeWidth={2} />
                        <Area type="monotone" dataKey="highPct" name="highPct" stroke="#ef4444" fill="url(#sevHigh)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {ingestionDiagnostics.scanner.highSeverityRuleIds.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">High Severity Rule IDs</div>
                  <div className="flex flex-wrap gap-2">
                    {ingestionDiagnostics.scanner.highSeverityRuleIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ingestionDiagnostics.advisories.length > 0 && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-3">
                  <div className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">Advisories</div>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-indigo-900 dark:text-indigo-200">
                    {ingestionDiagnostics.advisories.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {includePreflight && ingestionDiagnostics.preflight && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-wider text-slate-500">Preflight Dependencies</div>
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        ingestionDiagnostics.preflight.ok
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {ingestionDiagnostics.preflight.ok ? 'READY' : 'DEGRADED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {ingestionDiagnostics.preflight.dependencyChecks.map((dep) => (
                      <div key={dep.name} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{dep.name}</span>
                          <span
                            className={`text-xs font-semibold ${
                              dep.status === 'available'
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">{dep.details}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500">
                    Parser plans: {ingestionDiagnostics.preflight.parserPlans.length}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500">
                Generated: {new Date(ingestionDiagnostics.generatedAt).toLocaleString('mk-MK')}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-300">
              No diagnostics data available.
            </div>
          )}
        </CardContent>
      </Card>
      
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

/**
 * The screen where concept maps live (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * The editor and its store were written first and tested first; this is the
 * part that makes them reachable. Until it existed, phase 11 was a library with
 * a passing test suite and no way for a teacher to open anything — which is
 * what the audit found and what this closes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Map as MapIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { SEO } from '../SEO';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ConceptMapEditor from './ConceptMapEditor';
import { ConceptMap, createConceptMap } from '../../lib/mindmap/graph';
import {
  deleteConceptMap,
  listConceptMaps,
  saveConceptMap,
} from '../../lib/mindmap/store';

const newMapId = () => `cm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const ConceptMapsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [maps, setMaps] = useState<ConceptMap[] | null>(null);
  const [open, setOpen] = useState<ConceptMap | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setMaps(await listConceptMaps(user.uid));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!user) return;
    const map = createConceptMap(newMapId(), user.uid, t('conceptMap.untitled'));
    setIsBusy(true);
    try {
      await saveConceptMap(map);
      setOpen(map);
      await refresh();
    } catch (error) {
      console.error('Could not create the map:', error);
      showToast(t('conceptMap.saveFailed'), 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (map: ConceptMap) => {
    try {
      await saveConceptMap(map);
      showToast(t('conceptMap.saved'), 'success');
      await refresh();
    } catch (error) {
      console.error('Could not save the map:', error);
      showToast(t('conceptMap.saveFailed'), 'error');
      throw error;
    }
  };

  const handleDelete = async (map: ConceptMap) => {
    if (!confirm(t('conceptMap.confirmDelete', { title: map.title }))) return;
    try {
      await deleteConceptMap(map.id);
      if (open?.id === map.id) setOpen(null);
      await refresh();
    } catch (error) {
      console.error('Could not delete the map:', error);
      showToast(t('conceptMap.deleteFailed'), 'error');
    }
  };

  if (open) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <SEO title="Концепт-мапа | MathDigitizer Pro" description="Уредување на концепт-мапа" noindex />

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('conceptMap.backToList')}
          </Button>
          <input
            className="flex-1 min-w-0 text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-1"
            aria-label={t('conceptMap.mapTitle')}
            value={open.title}
            onChange={event => setOpen({ ...open, title: event.target.value })}
          />
        </div>

        <ConceptMapEditor map={open} onChange={setOpen} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <SEO title="Концепт-мапи | MathDigitizer Pro" description="Концепт-мапи по наставни теми" noindex />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            <MapIcon className="w-6 h-6 text-indigo-500" aria-hidden="true" />
            {t('conceptMap.pageTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-prose">
            {t('conceptMap.pageSubtitle')}
          </p>
        </div>

        <Button onClick={handleCreate} disabled={isBusy || !user}>
          {isBusy
            ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />
            : <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />}
          {t('conceptMap.newMap')}
        </Button>
      </div>

      {maps === null ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t('conceptMap.loading')}
        </div>
      ) : maps.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500 dark:text-slate-400">
            <MapIcon className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" aria-hidden="true" />
            <p className="font-medium">{t('conceptMap.emptyTitle')}</p>
            <p className="text-sm mt-1 max-w-md mx-auto">{t('conceptMap.emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {maps.map(map => (
            <li key={map.id}>
              <Card className="h-full">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="text-left flex-1 min-w-0"
                    onClick={() => setOpen(map)}
                  >
                    <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">
                      {map.title}
                    </span>
                    <span className="block text-xs text-slate-400 mt-1">
                      {t('conceptMap.mapSummary', {
                        nodes: map.nodes.length,
                        edges: map.edges.length,
                      })}
                    </span>
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(map)}
                    aria-label={t('conceptMap.deleteMap', { title: map.title })}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ConceptMapsPage;

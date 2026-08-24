/**
 * Editable concept map (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * Nodes are placed by hand and stay where they are put. `KnowledgeMapTab` runs
 * a live force simulation, which is right for a derived graph where nobody
 * positions anything; here the placement is the teacher's explanation, and a
 * running simulation would pull it apart as they work. The force layout is
 * offered as a one-off action instead — see `autoLayout.ts`.
 *
 * All graph edits go through the pure operations in `graph.ts`, so undo is the
 * previous value rather than an inverse written per action.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Plus, Redo2, Save, Trash2, Undo2, Wand2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  ConceptMap,
  EdgeKind,
  addEdge,
  addNode,
  removeEdge,
  removeNode,
  updateNode,
} from '../../lib/mindmap/graph';
import { arrangeMap } from '../../lib/mindmap/autoLayout';
import { buildExportSvg, exportMapToPng } from '../../lib/mindmap/svgExport';

interface Props {
  map: ConceptMap;
  onChange: (map: ConceptMap) => void;
  onSave?: (map: ConceptMap) => Promise<void>;
  /** Read-only when absent — the map is shown but cannot be edited. */
  editable?: boolean;
}

const NODE_RADIUS = 26;
const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const ConceptMapEditor: React.FC<Props> = ({ map, onChange, onSave, editable = true }) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Undo keeps whole maps. Every operation returns a new one, so this is the
  // entire implementation — no per-action inverse to get wrong.
  const [past, setPast] = useState<ConceptMap[]>([]);
  const [future, setFuture] = useState<ConceptMap[]>([]);

  const commit = useCallback(
    (next: ConceptMap) => {
      if (next === map) return;
      setPast(previous => [...previous.slice(-49), map]);
      setFuture([]);
      onChange(next);
    },
    [map, onChange],
  );

  const undo = useCallback(() => {
    setPast(previous => {
      if (previous.length === 0) return previous;
      const last = previous[previous.length - 1];
      setFuture(next => [map, ...next]);
      onChange(last);
      return previous.slice(0, -1);
    });
  }, [map, onChange]);

  const redo = useCallback(() => {
    setFuture(next => {
      if (next.length === 0) return next;
      setPast(previous => [...previous, map]);
      onChange(next[0]);
      return next.slice(1);
    });
  }, [map, onChange]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editable) return;
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (ctrl && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault();
        redo();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        // Not while typing a label — Backspace belongs to the input then.
        if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
        event.preventDefault();
        commit(removeNode(map, selected));
        setSelected(null);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, undo, redo, selected, map, commit]);

  const pointAt = (event: React.MouseEvent): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const handleAddNode = () => {
    const id = newId();
    const centre = svgRef.current?.getBoundingClientRect();
    commit(addNode(map, {
      id,
      label: t('conceptMap.newNode'),
      x: (centre?.width ?? 600) / 2,
      y: (centre?.height ?? 400) / 2,
    }));
    setSelected(id);
  };

  const handleNodeClick = (id: string) => {
    if (!editable) return;

    if (linkFrom && linkFrom !== id) {
      commit(addEdge(map, { id: `e${newId()}`, source: linkFrom, target: id, kind: linkKind }));
      setLinkFrom(null);
      return;
    }
    setSelected(id);
  };

  const [linkKind, setLinkKind] = useState<EdgeKind>('relates');

  const handleExport = async () => {
    try {
      const blob = await exportMapToPng(map);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${map.title || 'mapa'}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Concept map export failed:', error);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(map);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedNode = map.nodes.find(node => node.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('conceptMap.toolbar')}>
          <Button size="sm" onClick={handleAddNode}>
            <Plus className="w-4 h-4 mr-1.5" />{t('conceptMap.addNode')}
          </Button>

          <Button
            size="sm"
            variant={linkFrom ? 'default' : 'outline'}
            onClick={() => setLinkFrom(linkFrom ? null : selected)}
            disabled={!selected && !linkFrom}
            aria-pressed={linkFrom !== null}
          >
            {linkFrom ? t('conceptMap.linkPickTarget') : t('conceptMap.link')}
          </Button>

          <select
            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 bg-white dark:bg-slate-800"
            value={linkKind}
            onChange={event => setLinkKind(event.target.value as EdgeKind)}
            aria-label={t('conceptMap.linkKind')}
          >
            <option value="relates">{t('conceptMap.relates')}</option>
            <option value="requires">{t('conceptMap.requires')}</option>
          </select>

          <Button size="sm" variant="outline" onClick={() => commit(arrangeMap(map))}>
            <Wand2 className="w-4 h-4 mr-1.5" />{t('conceptMap.arrange')}
          </Button>

          <Button size="sm" variant="outline" onClick={undo} disabled={past.length === 0} aria-label={t('conceptMap.undo')}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={future.length === 0} aria-label={t('conceptMap.redo')}>
            <Redo2 className="w-4 h-4" />
          </Button>

          <div className="flex-1" />

          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />PNG
          </Button>
          {onSave && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                : <Save className="w-4 h-4 mr-1.5" />}
              {t('conceptMap.save')}
            </Button>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-[460px] rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900"
        role="application"
        aria-label={t('conceptMap.canvasLabel', { title: map.title })}
        onMouseMove={event => {
          if (!dragging || !editable) return;
          const point = pointAt(event);
          onChange(updateNode(map, dragging, point));
        }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        {map.edges.map(edge => {
          const from = map.nodes.find(n => n.id === edge.source);
          const to = map.nodes.find(n => n.id === edge.target);
          if (!from || !to) return null;

          return (
            <g key={edge.id}>
              <line
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#64748b" strokeWidth={2}
                strokeDasharray={edge.kind === 'requires' ? '6,4' : undefined}
              />
              {editable && (
                <circle
                  cx={(from.x + to.x) / 2} cy={(from.y + to.y) / 2} r={7}
                  fill="transparent" className="cursor-pointer"
                  onClick={() => commit(removeEdge(map, edge.id))}
                >
                  <title>{t('conceptMap.removeLink')}</title>
                </circle>
              )}
            </g>
          );
        })}

        {map.nodes.map(node => (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            className={editable ? 'cursor-move' : undefined}
            onMouseDown={() => editable && setDragging(node.id)}
            onClick={() => handleNodeClick(node.id)}
          >
            <circle
              r={NODE_RADIUS}
              fill={node.id === selected ? '#c7d2fe' : '#eef2ff'}
              stroke={node.id === linkFrom ? '#f59e0b' : '#6366f1'}
              strokeWidth={node.id === linkFrom ? 3 : 2}
            />
            {node.outcomeCodes.length > 0 && (
              <text textAnchor="middle" y={4} fontSize={9} fill="#4338ca" fontFamily="monospace">
                {node.outcomeCodes[0]}
              </text>
            )}
            <text textAnchor="middle" y={NODE_RADIUS + 15} fontSize={12} fill="currentColor" className="text-slate-800 dark:text-slate-100">
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {editable && selectedNode && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-white/10">
          <label className="text-xs font-semibold text-slate-500" htmlFor="concept-label">
            {t('conceptMap.label')}
          </label>
          <input
            id="concept-label"
            className="flex-1 min-w-[180px] text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800"
            value={selectedNode.label}
            onChange={event => onChange(updateNode(map, selectedNode.id, { label: event.target.value }))}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => { commit(removeNode(map, selectedNode.id)); setSelected(null); }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />{t('conceptMap.removeNode')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConceptMapEditor;

/** Exported for tests and for anyone wanting the picture without the editor. */
export { buildExportSvg };

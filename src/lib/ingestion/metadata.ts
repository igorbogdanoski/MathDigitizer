import { MathTask } from '../schema';

export interface IngestionMeta {
  sourceKind: 'url' | 'text' | 'file' | 'pdf' | 'image';
  parserPath: string;
  sanitize: {
    changed: boolean;
    removedInvisibleCount: number;
    removedBidiCount: number;
  };
  scan: {
    highestSeverity: 'low' | 'medium' | 'high' | null;
    findingIds: string[];
  };
  generatedAt: string;
}

export interface PersistedIngestionSnapshot {
  source_kind: 'url' | 'text' | 'file' | 'pdf' | 'image';
  parser_path: string;
  highest_severity: 'none' | 'low' | 'medium' | 'high';
  sanitized: boolean;
  finding_ids: string[];
  finding_count: number;
  generated_at: string;
}

export type TaskWithIngestionMeta = MathTask & {
  __ingestion_meta?: IngestionMeta;
};

export function attachIngestionMeta(tasks: MathTask[], meta: IngestionMeta): TaskWithIngestionMeta[] {
  return tasks.map((task) => ({ ...task, __ingestion_meta: meta }));
}

export function stripIngestionMetaForPersistence<T extends Record<string, unknown>>(task: T): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __ingestion_meta, ...safeTask } = task as T & { __ingestion_meta?: IngestionMeta };
  return safeTask as T;
}

function sanitizeString(value: string, max: number): string {
  return value.slice(0, max);
}

export function buildPersistedIngestionSnapshot(meta?: IngestionMeta): PersistedIngestionSnapshot | undefined {
  if (!meta) return undefined;

  return {
    source_kind: meta.sourceKind,
    parser_path: sanitizeString(meta.parserPath, 120),
    highest_severity: meta.scan.highestSeverity ?? 'none',
    sanitized: meta.sanitize.changed,
    finding_ids: meta.scan.findingIds.slice(0, 10).map((id) => sanitizeString(id, 80)),
    finding_count: Math.max(0, Math.min(50, meta.scan.findingIds.length)),
    generated_at: sanitizeString(meta.generatedAt, 40),
  };
}

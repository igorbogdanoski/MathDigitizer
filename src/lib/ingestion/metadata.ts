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

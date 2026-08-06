import { describe, expect, it } from 'vitest';
import { attachIngestionMeta, stripIngestionMetaForPersistence } from './metadata';

describe('ingestion metadata helpers', () => {
  it('attaches metadata to tasks for in-memory diagnostics', () => {
    const tasks = [{ title: 'A', original_text: 'x+1=2', solution_steps: [], latex_formulas: [], source_url: 'x', tags: [], difficulty: 'easy' as const }];
    const out = attachIngestionMeta(tasks, {
      sourceKind: 'text',
      parserPath: 'text->multimodal',
      sanitize: { changed: false, removedInvisibleCount: 0, removedBidiCount: 0 },
      scan: { highestSeverity: null, findingIds: [] },
      generatedAt: new Date().toISOString(),
    });

    expect(out[0].__ingestion_meta?.sourceKind).toBe('text');
  });

  it('strips metadata before persistence', () => {
    const task = {
      title: 'A',
      original_text: 'x+1=2',
      solution_steps: [],
      latex_formulas: [],
      source_url: 'x',
      tags: [],
      difficulty: 'easy' as const,
      __ingestion_meta: { sourceKind: 'text' as const, parserPath: 'x', sanitize: { changed: false, removedInvisibleCount: 0, removedBidiCount: 0 }, scan: { highestSeverity: null, findingIds: [] }, generatedAt: new Date().toISOString() },
    };

    const safe = stripIngestionMetaForPersistence(task);
    expect('__ingestion_meta' in safe).toBe(false);
  });
});

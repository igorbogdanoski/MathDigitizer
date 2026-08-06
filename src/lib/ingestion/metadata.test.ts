import { describe, expect, it } from 'vitest';
import {
  attachIngestionMeta,
  buildPersistedIngestionSnapshot,
  stripIngestionMetaForPersistence,
} from './metadata';

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

  it('builds a bounded snapshot for optional persistence', () => {
    const snapshot = buildPersistedIngestionSnapshot({
      sourceKind: 'url',
      parserPath: 'url->transcript->extract',
      sanitize: { changed: true, removedInvisibleCount: 3, removedBidiCount: 2 },
      scan: { highestSeverity: 'high', findingIds: ['prompt.ignore_previous', 'prompt.bypass_safety'] },
      generatedAt: new Date().toISOString(),
    });

    expect(snapshot?.source_kind).toBe('url');
    expect(snapshot?.highest_severity).toBe('high');
    expect(snapshot?.sanitized).toBe(true);
    expect(snapshot?.finding_count).toBe(2);
    expect(snapshot?.finding_ids.length).toBe(2);
  });

  it('returns undefined snapshot when metadata is missing', () => {
    expect(buildPersistedIngestionSnapshot(undefined)).toBeUndefined();
  });
});

import React from 'react';
import {
  buildPersistedIngestionSnapshot,
  IngestionMeta,
  stripIngestionMetaForPersistence,
} from '../../lib/ingestion/metadata';
import { resolveIngestionSnapshotPersistenceEnabled } from '../../lib/ingestion/config';

const sampleMeta: IngestionMeta = {
  sourceKind: 'text',
  parserPath: 'probe/parser-path',
  sanitize: {
    changed: true,
    removedInvisibleCount: 2,
    removedBidiCount: 1,
  },
  scan: {
    highestSeverity: 'high',
    findingIds: ['probe-high-1', 'probe-high-2'],
  },
  generatedAt: '2026-01-01T00:00:00.000Z',
};

function buildSavedTask(flagOverride: boolean) {
  const task = {
    title: 'Probe Task',
    original_text: '2 + 2 = 4',
    __ingestion_meta: sampleMeta,
  } as const;

  const taskToSave: Record<string, unknown> = {
    ...stripIngestionMetaForPersistence(task),
    author_uid: 'probe-user',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  if (resolveIngestionSnapshotPersistenceEnabled(flagOverride)) {
    const snapshot = buildPersistedIngestionSnapshot(task.__ingestion_meta);
    if (snapshot) taskToSave.ingestion_snapshot = snapshot;
  }

  return taskToSave;
}

export function IngestionSnapshotFlagProbe() {
  const envEnabled = resolveIngestionSnapshotPersistenceEnabled();
  const withFlagOff = buildSavedTask(false);
  const withFlagOn = buildSavedTask(true);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Ingestion Snapshot Flag Probe</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Development-only test harness used by Playwright to validate ingestion snapshot persistence behavior.
      </p>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-semibold">Environment flag state</h2>
        <div data-testid="env-flag-enabled">{String(envEnabled)}</div>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-semibold">Save payload with override = false</h2>
        <pre data-testid="payload-override-false" className="text-xs overflow-x-auto">
          {JSON.stringify(withFlagOff, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-semibold">Save payload with override = true</h2>
        <pre data-testid="payload-override-true" className="text-xs overflow-x-auto">
          {JSON.stringify(withFlagOn, null, 2)}
        </pre>
      </section>
    </main>
  );
}

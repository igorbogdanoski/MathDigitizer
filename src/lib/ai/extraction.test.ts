import { describe, it, expect, vi } from 'vitest';

// The module pulls in the ai client (network) at import time — stub it so the
// pure parse/merge helpers can be tested in isolation.
vi.mock('./client', () => ({
  ai: { models: { generateContent: vi.fn() } },
  handleGeminiError: (e: unknown) => { throw e; },
  apiUrl: (p: string) => p,
}));
vi.mock('./utils', () => ({
  parseGeminiResponse: (t: string) => JSON.parse(t),
  buildCurriculumContextBlockRag: async () => '',
}));

import {
  formatTimeFromMs,
  resolveTargetLanguageLabel,
  buildContextFromScrapePayload,
  buildVisualizationInstruction,
  normalizeExtractionConfidence,
  normalizeExtractedTasks,
} from './extraction';

describe('formatTimeFromMs', () => {
  it('formats milliseconds as MM:SS with zero padding', () => {
    expect(formatTimeFromMs(0)).toBe('00:00');
    expect(formatTimeFromMs(5_000)).toBe('00:05');
    expect(formatTimeFromMs(65_000)).toBe('01:05');
    expect(formatTimeFromMs(3_723_000)).toBe('62:03');
  });
});

describe('resolveTargetLanguageLabel', () => {
  it('maps every supported code to its own label', () => {
    expect(resolveTargetLanguageLabel('mk')).toContain('Македонски');
    expect(resolveTargetLanguageLabel('en')).toBe('Англиски');
    expect(resolveTargetLanguageLabel('ru')).toBe('Руски');
    expect(resolveTargetLanguageLabel('tr')).toBe('Турски');
  });

  it('maps Albanian to Albanian, not Turkish (regression: sq/al fell through)', () => {
    expect(resolveTargetLanguageLabel('al')).toBe('Албански');
    expect(resolveTargetLanguageLabel('sq')).toBe('Албански');
    expect(resolveTargetLanguageLabel('AL')).toBe('Албански');
  });

  it('never silently substitutes another language for an unknown code', () => {
    const label = resolveTargetLanguageLabel('zz');
    expect(label).toContain('zz');
    expect(label).not.toBe('Турски');
  });
});

describe('buildContextFromScrapePayload', () => {
  it('prefers timestamped fragments', () => {
    const out = buildContextFromScrapePayload({
      fragments: [
        { offset: 0, text: 'Здраво' },
        { offset: 61_000, text: 'функции' },
      ],
    });
    expect(out).toBe('[00:00] Здраво\n[01:01] функции');
  });

  it('falls back to transcript, then title + content', () => {
    expect(buildContextFromScrapePayload({ fragments: [], transcript: 'plain' })).toBe('plain');
    expect(buildContextFromScrapePayload({ title: 'T', content: 'C' })).toBe('T\n\nC');
  });

  it('returns an empty string for unusable payloads', () => {
    expect(buildContextFromScrapePayload(null)).toBe('');
    expect(buildContextFromScrapePayload({})).toBe('');
    expect(buildContextFromScrapePayload('<html>')).toBe('');
  });
});

describe('buildVisualizationInstruction', () => {
  it('emits a distinct instruction per mode', () => {
    expect(buildVisualizationInstruction('none')).toMatch(/НЕ генерирај/);
    expect(buildVisualizationInstruction('tikz')).toMatch(/tikzpicture/);
    expect(buildVisualizationInstruction('geogebra')).toMatch(/geogebra_commands/);
    expect(buildVisualizationInstruction('nanobanana')).toMatch(/illustration_prompt/);
  });

  it('defaults to GeoGebra for missing or unknown modes', () => {
    const fallback = buildVisualizationInstruction('geogebra');
    expect(buildVisualizationInstruction(undefined)).toBe(fallback);
    expect(buildVisualizationInstruction('bogus')).toBe(fallback);
  });
});

describe('normalizeExtractionConfidence', () => {
  it('clamps to the 1-100 contract and rounds', () => {
    expect(normalizeExtractionConfidence(87)).toBe(87);
    expect(normalizeExtractionConfidence(87.4)).toBe(87);
    expect(normalizeExtractionConfidence(0)).toBe(1);
    expect(normalizeExtractionConfidence(140)).toBe(100);
  });

  it('drops non-numeric values instead of persisting garbage', () => {
    expect(normalizeExtractionConfidence('90')).toBeUndefined();
    expect(normalizeExtractionConfidence(NaN)).toBeUndefined();
    expect(normalizeExtractionConfidence(undefined)).toBeUndefined();
  });
});

describe('normalizeExtractedTasks', () => {
  const task = (over: Record<string, unknown> = {}) => ({ original_text: 'Реши $x+1=2$', title: 'T', ...over });

  it('accepts the bare-array response shape (PDF/image schemas)', () => {
    const out = normalizeExtractedTasks([task(), task()], { sourceUrl: 'PDF Документ' });
    expect(out).toHaveLength(2);
    expect(out[0].source_url).toBe('PDF Документ');
  });

  it('accepts the object response shape and stamps shared confidence on every task', () => {
    const out = normalizeExtractedTasks(
      { extraction_confidence: 72, extracted_tasks: [task(), task()] },
      { sourceUrl: 'https://x.test/v' }
    );
    expect(out).toHaveLength(2);
    expect(out.every(t => (t as any).extraction_confidence === 72)).toBe(true);
    expect(out.every(t => t.source_url === 'https://x.test/v')).toBe(true);
  });

  it('uses per-task confidence from the image/PDF array schemas', () => {
    const out = normalizeExtractedTasks(
      [task({ extraction_confidence: 91 }), task({ extraction_confidence: 12.6 }), task()],
      { sourceUrl: 'Слика (Напреден OCR)' }
    );
    expect(out.map(t => (t as any).extraction_confidence)).toEqual([91, 13, undefined]);
  });

  it('lets per-task confidence override the response-level value', () => {
    const out = normalizeExtractedTasks(
      { extraction_confidence: 50, extracted_tasks: [task({ extraction_confidence: 95 }), task()] },
      { sourceUrl: 'src' }
    );
    expect(out.map(t => (t as any).extraction_confidence)).toEqual([95, 50]);
  });

  it('omits the confidence field entirely when the model did not report one', () => {
    const [out] = normalizeExtractedTasks([task()], { sourceUrl: 'PDF Документ' });
    expect('extraction_confidence' in out).toBe(false);
  });

  it('drops malformed rows so they never reach Firestore', () => {
    const out = normalizeExtractedTasks(
      [task(), null, 'string', { title: 'no text' }, task({ original_text: '   ' })],
      { sourceUrl: 'src' }
    );
    expect(out).toHaveLength(1);
  });

  it('returns an empty array for a response with no tasks', () => {
    expect(normalizeExtractedTasks({ notebook_briefing: 'x' }, { sourceUrl: 'src' })).toEqual([]);
    expect(normalizeExtractedTasks(null, { sourceUrl: 'src' })).toEqual([]);
  });

  it('preserves model fields such as evidence_quote and solution_steps', () => {
    const [out] = normalizeExtractedTasks(
      [task({ evidence_quote: 'цитат', solution_steps: ['чекор 1'] })],
      { sourceUrl: 'src' }
    );
    expect((out as any).evidence_quote).toBe('цитат');
    expect(out.solution_steps).toEqual(['чекор 1']);
  });
});

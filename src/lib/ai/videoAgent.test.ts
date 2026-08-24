import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FLASH_36_MODEL, FLASH_37_MODEL } from '@/src/lib/ai/models';
import {
  dedupeVisualItems,
  extractMathTasksFromVideoAgentic,
  formatClock,
  mergeVisualIntoTasks,
  planSegments,
  type VisualBoardItem,
} from '@/src/lib/ai/videoAgent';

const { mockGenerateContent, mockExtractFromUrl } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockExtractFromUrl: vi.fn(),
}));

vi.mock('@/src/lib/ai/client', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => mockGenerateContent(...args) } },
}));

vi.mock('@/src/lib/ai/extraction', () => ({
  extractMathTasksFromUrl: (...args: unknown[]) => mockExtractFromUrl(...args),
}));

const baseTask = () => ({
  title: 'Base task',
  original_text: 'solve x+1=2',
  solution_steps: ['x=1'],
  latex_formulas: ['x+1=2'],
  source_url: 'https://youtube.com/watch?v=test',
  tags: [],
  difficulty: 'easy' as const,
});

function installGenerateContentMock() {
  mockGenerateContent.mockImplementation(async (payload: any) => {
    const model = payload.model;
    const schema = payload.config?.responseSchema;
    const text = payload.contents?.[1]?.text ?? '';

    if (schema?.properties?.durationSec) {
      if (model === FLASH_37_MODEL) throw new Error('404 MODEL_NOT_FOUND');
      return { text: JSON.stringify({ durationSec: 1300 }) };
    }

    if (text.includes('verbatim transcript')) {
      const m = text.match(/from ([\d:]+) to ([\d:]+)/);
      return { text: `[${m?.[1] ?? '00:00'}] spoken math content` };
    }

    if (text.includes('visually written')) {
      const m = text.match(/from ([\d:]+) to ([\d:]+)/);
      const items =
        m?.[1] === '00:00'
          ? [
              { stampSec: 40, kind: 'board', latex: ['x+1=2'], description: 'board equation', mathGraphicConfigJson: '' },
              { stampSec: 80, kind: 'graph', latex: ['a^2+b^2=c^2'], description: 'right triangle', mathGraphicConfigJson: '{"shape":"triangle"}' },
            ]
          : [{ stampSec: 600, kind: 'board', latex: ['x+1=2'], description: 'same board equation repeated', mathGraphicConfigJson: '' }];
      return { text: JSON.stringify({ items }) };
    }

    return { text: '' };
  });
}

describe('videoAgent segment planning', () => {
  it('keeps short videos on a single pass', () => {
    expect(planSegments(600)).toEqual([{ startSec: 0, endSec: 600 }]);
    expect(planSegments(900)).toEqual([{ startSec: 0, endSec: 900 }]);
  });

  it('chunks long videos with overlap and full coverage', () => {
    const segments = planSegments(3600);
    expect(segments[0]).toEqual({ startSec: 0, endSec: 600 });
    expect(segments[segments.length - 1].endSec).toBe(3600);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].startSec).toBe(segments[i - 1].endSec - 30);
    }
  });

  it('assumes an hour when the duration probe fails', () => {
    expect(planSegments(null)).toEqual(planSegments(3600));
  });

  it('formats clocks in MM:SS and H:MM:SS', () => {
    expect(formatClock(570)).toBe('09:30');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('visual item dedupe and merge', () => {
  const item = (stampSec: number, latex: string[], kind: 'board' | 'graph' = 'board'): VisualBoardItem => ({
    stampSec,
    kind,
    latex,
    description: 'd',
  });

  it('collapses repeated board states to the earliest stamp', () => {
    const deduped = dedupeVisualItems([item(600, ['x+1=2']), item(40, ['x+1=2']), item(80, ['a^2+b^2=c^2'], 'graph')]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].stampSec).toBe(40);
  });

  it('enriches matching tasks and appends unseen visual content', () => {
    const tasks = [baseTask()];
    const merged = mergeVisualIntoTasks(tasks as any, [item(40, ['x+1=2']), item(80, ['a^2+b^2=c^2'], 'graph')], 'https://youtube.com/watch?v=test');
    expect(merged).toHaveLength(2);
    expect(merged[0].source_timestamp).toBe('00:40');
    expect(merged[1].latex_formulas).toEqual(['a^2+b^2=c^2']);
    expect(merged[1].source_timestamp).toBe('01:20');
  });
});

describe('extractMathTasksFromVideoAgentic', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockGenerateContent.mockReset();
    mockExtractFromUrl.mockReset();
    mockExtractFromUrl.mockImplementation(async () => [baseTask()]);
    installGenerateContentMock();
  });

  it('falls back from 3.7 to 3.6 when the probe model is unknown', async () => {
    await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');

    const probeCalls = mockGenerateContent.mock.calls.filter(
      (call: any[]) => call[0].config?.responseSchema?.properties?.durationSec
    );
    expect(probeCalls[0][0].model).toBe(FLASH_37_MODEL);
    expect(probeCalls[1][0].model).toBe(FLASH_36_MODEL);
  });

  it('concatenates per-segment transcripts in order and feeds the strict extraction', async () => {
    await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');

    expect(mockExtractFromUrl).toHaveBeenCalledTimes(1);
    const mergedTranscript = mockExtractFromUrl.mock.calls[0][3] as string;
    expect(mergedTranscript).toContain('[00:00] spoken math content');
    expect(mergedTranscript).toContain('[09:30] spoken math content');
    expect(mergedTranscript).toContain('[19:00] spoken math content');
    expect(mergedTranscript.indexOf('[00:00]')).toBeLessThan(mergedTranscript.indexOf('[09:30]'));
  });

  it('requests the audio pass at low media resolution', async () => {
    await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');

    const transcriptCalls = mockGenerateContent.mock.calls.filter((call: any[]) =>
      (call[0].contents?.[1]?.text ?? '').includes('verbatim transcript')
    );
    expect(transcriptCalls.length).toBe(3);
    for (const call of transcriptCalls) {
      expect(call[0].config?.mediaResolution).toBe('MEDIA_RESOLUTION_LOW');
    }
  });

  it('merges deduped visual items into the extraction result', async () => {
    const result = await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');

    expect(result).toHaveLength(2);
    expect(result[1].math_graphic_config).toEqual({ shape: 'triangle' });
    expect(result[1].tags).toContain('video-visual');
  });

  it('serves repeat runs from the transcript cache', async () => {
    await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');
    const callsAfterFirst = mockGenerateContent.mock.calls.length;

    await extractMathTasksFromVideoAgentic('https://youtube.com/watch?v=test');
    expect(mockGenerateContent.mock.calls.length).toBe(callsAfterFirst);
    expect(mockExtractFromUrl).toHaveBeenCalledTimes(2);
  });
});

/**
 * Agentic long-video extraction domain.
 *
 * Long math lectures (>15 min) break single-pass transcript extraction twice:
 * the "complete verbatim transcript" call gets truncated by the model output
 * limit, and the audio transcript is blind to what is written/drawn on the
 * board. This module runs a deterministic TS-orchestrated pipeline where
 * FLASH_37 acts as the per-segment worker:
 *
 *   1. probe   — ask the model for the video duration, plan 10-min segments
 *   2. audio   — per-segment verbatim transcript (LOW media resolution: cheap)
 *   3. visual  — per-segment board/diagram pass (structured LaTeX + graphics)
 *   4. merge   — chunked transcript feeds the existing strict JSON extraction;
 *                visual items enrich matching tasks or become tasks themselves
 *
 * Orchestration stays in code (explicit strategy, no hidden prompt drift, per
 * PRODUCT_RULES); the model only does per-segment perception.
 */
import { Type } from '@google/genai';
import { ai } from './client';
import { FLASH_36_MODEL, FLASH_37_MODEL, PRO_MODEL } from './models';
import { extractMathTasksFromUrl } from './extraction';
import { attachIngestionMeta } from '../ingestion/metadata';
import { MathTask } from '../schema';

export interface VideoSegment {
  startSec: number;
  endSec: number;
}

export interface VisualBoardItem {
  stampSec: number;
  kind: 'board' | 'diagram' | 'graph';
  latex: string[];
  description: string;
  mathGraphicConfig?: any;
  illustrationPrompt?: string;
}

export type AgenticProgress = (pct: number, label: string) => void;

export const SEGMENT_SEC = 600;
export const OVERLAP_SEC = 30;
export const SINGLE_PASS_THRESHOLD_SEC = 900;
const ASSUMED_DURATION_SEC = 3600;
const CACHE_KEY = 'video_agent_transcript_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_CHARS = 400_000;

export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function planSegments(durationSec: number | null): VideoSegment[] {
  const duration = durationSec && durationSec > 0 ? durationSec : ASSUMED_DURATION_SEC;
  if (duration <= SINGLE_PASS_THRESHOLD_SEC) return [{ startSec: 0, endSec: duration }];

  const segments: VideoSegment[] = [];
  let start = 0;
  while (start < duration) {
    const end = Math.min(start + SEGMENT_SEC, duration);
    segments.push({ startSec: start, endSec: end });
    if (end >= duration) break;
    start = end - OVERLAP_SEC;
  }
  return segments;
}

async function withFlashFallback(call: (model: string) => Promise<any>): Promise<{ value: any; model: string }> {
  try {
    return { value: await call(FLASH_37_MODEL), model: FLASH_37_MODEL };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!/404|NOT_FOUND|not found/i.test(msg)) throw error;
    return { value: await call(FLASH_36_MODEL), model: FLASH_36_MODEL };
  }
}

async function probeDurationSec(url: string): Promise<number | null> {
  try {
    const { value } = await withFlashFallback((model) =>
      ai.models.generateContent({
        model,
        contents: [
          { fileData: { fileUri: url } },
          { text: 'Report the exact duration of this video. Return ONLY JSON like {"durationSec": 3600}.' },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { durationSec: { type: Type.NUMBER } },
          },
        },
      })
    );
    const parsed = JSON.parse(value.text?.trim() || '{}');
    return typeof parsed.durationSec === 'number' && parsed.durationSec > 0 ? parsed.durationSec : null;
  } catch {
    return null;
  }
}

async function fetchSegmentTranscript(url: string, seg: VideoSegment): Promise<string> {
  const window = `Focus ONLY on the segment from ${formatClock(seg.startSec)} to ${formatClock(seg.endSec)}.`;
  const prompt = `Extract the COMPLETE verbatim transcript of this video segment with timestamps in [MM:SS] format before each spoken segment. ${window}
Rules:
- PRESERVE the EXACT original spoken language. Do NOT translate under any circumstances.
- Include ALL spoken words, including mathematical terms, formulas, and numbers exactly as spoken.
- Return ONLY the raw transcript text. No commentary, no headers, no JSON. Start directly with the first timestamp.`;

  // LOW resolution is enough for the audio pass and keeps video tokens cheap;
  // older deployments may reject the field, so retry without it.
  const { value: response } = await withFlashFallback((model) => {
    const call = (config: Record<string, unknown>) =>
      ai.models.generateContent({
        model,
        contents: [{ fileData: { fileUri: url } }, { text: prompt }],
        config,
      });
    return call({ mediaResolution: 'MEDIA_RESOLUTION_LOW' }).catch(() => call({}));
  });
  return response.text?.trim() ?? '';
}

async function fetchSegmentVisual(url: string, seg: VideoSegment): Promise<VisualBoardItem[]> {
  const window = `Analyze ONLY the segment from ${formatClock(seg.startSec)} to ${formatClock(seg.endSec)}.`;
  const { value } = await withFlashFallback((model) =>
    ai.models.generateContent({
      model,
      contents: [
        { fileData: { fileUri: url } },
        {
          text: `You watch a math lecture. ${window} Extract ONLY what is visually written or drawn (board, slides, diagrams, graphs) — ignore pure speech.
Rules:
- Every formula MUST be strict LaTeX (no unicode math symbols).
- One item per distinct board state / diagram / graph, with the timestamp where it first appears.
- mathGraphicConfigJson: a JSON STRING with a geometry/graph config when the item is a diagram or graph, else empty string.
- Return ONLY JSON.`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stampSec: { type: Type.NUMBER },
                  kind: { type: Type.STRING },
                  latex: { type: Type.ARRAY, items: { type: Type.STRING } },
                  description: { type: Type.STRING },
                  mathGraphicConfigJson: { type: Type.STRING },
                  illustrationPrompt: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    })
  );

  try {
    const parsed = JSON.parse(value.text?.trim() || '{"items":[]}');
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    return rawItems.map((item: any): VisualBoardItem => {
      let mathGraphicConfig;
      if (typeof item.mathGraphicConfigJson === 'string' && item.mathGraphicConfigJson.trim()) {
        try {
          mathGraphicConfig = JSON.parse(item.mathGraphicConfigJson);
        } catch {
          mathGraphicConfig = undefined;
        }
      }
      return {
        stampSec: typeof item.stampSec === 'number' ? item.stampSec : seg.startSec,
        kind: item.kind === 'diagram' || item.kind === 'graph' ? item.kind : 'board',
        latex: Array.isArray(item.latex) ? item.latex.filter((l: unknown) => typeof l === 'string') : [],
        description: typeof item.description === 'string' ? item.description : '',
        mathGraphicConfig,
        illustrationPrompt: typeof item.illustrationPrompt === 'string' && item.illustrationPrompt ? item.illustrationPrompt : undefined,
      };
    });
  } catch {
    return [];
  }
}

export { normalizeLatex } from './validate';
import { normalizeLatex } from './validate';

function visualSignature(item: VisualBoardItem): string {
  return `${item.kind}|${[...item.latex].map(normalizeLatex).sort().join(',')}`;
}

export function dedupeVisualItems(items: VisualBoardItem[]): VisualBoardItem[] {
  const seen = new Map<string, VisualBoardItem>();
  for (const item of items) {
    const sig = visualSignature(item);
    const existing = seen.get(sig);
    if (!existing || item.stampSec < existing.stampSec) seen.set(sig, item);
  }
  return [...seen.values()].sort((a, b) => a.stampSec - b.stampSec);
}

interface CacheEntry {
  mergedTranscript: string;
  visualItems: VisualBoardItem[];
  at: number;
}

function readCache(url: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = map[url];
    if (!entry || Date.now() - entry.at > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeCache(url: string, entry: CacheEntry): void {
  if (entry.mergedTranscript.length > CACHE_MAX_CHARS) return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, CacheEntry>;
    map[url] = entry;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // localStorage full or blocked — caching is best-effort
  }
}

function toVisualTask(item: VisualBoardItem, url: string): MathTask {
  const inline = item.latex.map((l) => `$${l}$`).join(' ');
  return {
    title: `Визуелен извод ${formatClock(item.stampSec)} (${item.kind})`,
    original_text: item.description ? `${item.description} ${inline}`.trim() : inline,
    solution_steps: [],
    latex_formulas: item.latex,
    source_url: url,
    source_timestamp: formatClock(item.stampSec),
    evidence_quote: item.description || undefined,
    tags: ['video-visual'],
    difficulty: 'medium',
    type: 'task',
    math_graphic_config: item.mathGraphicConfig,
    illustration_prompt: item.illustrationPrompt,
  };
}

export function mergeVisualIntoTasks(tasks: MathTask[], items: VisualBoardItem[], url: string): MathTask[] {
  const merged = [...tasks];
  for (const item of items) {
    const sigs = new Set(item.latex.map(normalizeLatex));
    const match = merged.find((task) => (task.latex_formulas || []).some((l) => sigs.has(normalizeLatex(l))));
    if (match) {
      if (item.mathGraphicConfig && !match.math_graphic_config) match.math_graphic_config = item.mathGraphicConfig;
      if (item.illustrationPrompt && !match.illustration_prompt) match.illustration_prompt = item.illustrationPrompt;
      if (!match.source_timestamp) match.source_timestamp = formatClock(item.stampSec);
    } else if (item.latex.length > 0 || item.mathGraphicConfig) {
      merged.push(toVisualTask(item, url));
    }
  }
  return merged;
}

export interface AgenticVideoOptions {
  model?: string;
  instructions?: string;
  outputLanguage?: string;
  onProgress?: AgenticProgress;
}

export async function extractMathTasksFromVideoAgentic(url: string, opts: AgenticVideoOptions = {}): Promise<MathTask[]> {
  const report = opts.onProgress ?? (() => {});
  const cached = readCache(url);

  let mergedTranscript: string;
  let visualItems: VisualBoardItem[];

  if (cached) {
    mergedTranscript = cached.mergedTranscript;
    visualItems = cached.visualItems;
    report(50, 'Агентски режим: кеширан транскрипт');
  } else {
    report(5, 'Агентски режим: планирање сегменти…');
    const durationSec = await probeDurationSec(url);
    const segments = planSegments(durationSec);

    const transcripts: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      report(10 + Math.floor((i / segments.length) * 40), `Агентски режим: транскрипт ${i + 1}/${segments.length} (${formatClock(segments[i].startSec)}–${formatClock(segments[i].endSec)})`);
      const part = await fetchSegmentTranscript(url, segments[i]);
      if (part) transcripts.push(part);
    }

    const visuals: VisualBoardItem[] = [];
    for (let i = 0; i < segments.length; i++) {
      report(50 + Math.floor((i / segments.length) * 35), `Агентски режим: визуелен пасус ${i + 1}/${segments.length}`);
      try {
        visuals.push(...(await fetchSegmentVisual(url, segments[i])));
      } catch (error) {
        console.warn(`[videoAgent] visual pass failed for segment ${i + 1}:`, error);
      }
    }

    mergedTranscript = transcripts.join('\n');
    visualItems = dedupeVisualItems(visuals);
    writeCache(url, { mergedTranscript, visualItems, at: Date.now() });
  }

  report(88, 'Агентски режим: строга JSON екстракција…');
  const tasks = await extractMathTasksFromUrl(
    url,
    opts.model ?? PRO_MODEL,
    undefined,
    mergedTranscript,
    opts.instructions,
    opts.outputLanguage
  );

  const withVisuals = mergeVisualIntoTasks(tasks, visualItems, url);
  const visualOnly = withVisuals.slice(tasks.length);
  const attached =
    visualOnly.length > 0
      ? [...withVisuals.slice(0, tasks.length), ...attachIngestionMeta(visualOnly, {
          sourceKind: 'url',
          parserPath: 'url->agentic-video->visual',
          sanitize: { changed: false, removedInvisibleCount: 0, removedBidiCount: 0 },
          scan: { highestSeverity: null, findingIds: [] },
          generatedAt: new Date().toISOString(),
        })]
      : withVisuals;

  report(95, 'Агентски режим: завршено');
  return attached;
}

/**
 * SmartOCR save-payload helpers — Phase 3.3 of EXPERT_LEVEL_MASTER_PLAN.
 *
 * The OCR editor shows one text blob (task text + solution). Before this module
 * that blob was written straight into `original_text`, so the solution ended up
 * glued onto the task statement and `solution_steps` was left holding the stale
 * pre-edit value. These helpers keep the two directions — task → editor text and
 * editor text → task fields — in one place so the round trip stays lossless.
 */
import { MathTask } from '../../lib/schema';

/** Marker the editor uses to separate the statement from the worked solution. */
export const SOLUTION_MARKER = '**Решение:**';

/** Matches the marker in any of the supported UI languages. */
const SOLUTION_MARKER_RE = /^\s*\*\*\s*(Решение|Solution|Zgjidhja|Çözüm|Решение задачи)\s*:?\s*\*\*\s*$/im;

/** Renders a task into the single editable blob shown in the code view. */
export function formatOcrEditorText(task: Partial<MathTask> | null | undefined): string {
  if (!task) return '';
  const statement = (task.original_text || '').trim();
  const steps = (task.solution_steps || []).filter(s => typeof s === 'string' && s.trim());
  if (steps.length === 0) return statement;
  return `${statement}\n\n${SOLUTION_MARKER}\n${steps.join('\n')}`;
}

/**
 * Inverse of formatOcrEditorText: splits the edited blob back into the task
 * statement and the individual solution steps.
 */
export function parseOcrEditorText(text: string): { original_text: string; solution_steps: string[] } {
  const source = text ?? '';
  const lines = source.split(/\r?\n/);
  const markerIndex = lines.findIndex(line => SOLUTION_MARKER_RE.test(line));

  if (markerIndex === -1) {
    return { original_text: source.trim(), solution_steps: [] };
  }

  const original_text = lines.slice(0, markerIndex).join('\n').trim();
  const solution_steps = lines
    .slice(markerIndex + 1)
    .map(line => line.trim())
    .filter(Boolean);

  return { original_text, solution_steps };
}

export interface OcrSavePayloadOptions {
  authorUid: string;
  createdAt?: string;
  embedding?: number[];
}

/**
 * Builds the Firestore payload for a SmartOCR task. The edited editor text wins
 * over the model's original fields, but statement and solution stay separate.
 */
export function buildOcrTaskPayload(
  task: Partial<MathTask>,
  editorText: string,
  options: OcrSavePayloadOptions
): Partial<MathTask> & { author_uid: string; created_at: string } {
  const { original_text, solution_steps } = parseOcrEditorText(editorText);

  return {
    ...task,
    original_text: original_text || (task.original_text || '').trim(),
    // Only replace the model's steps when the editor actually carries a solution
    solution_steps: solution_steps.length > 0 ? solution_steps : (task.solution_steps || []),
    author_uid: options.authorUid,
    created_at: options.createdAt ?? new Date().toISOString(),
    ...(options.embedding ? { embedding: options.embedding } : {}),
  };
}

/** Text used for the task embedding — parity with ExtractionEngine's save path. */
export function buildOcrEmbeddingText(task: Partial<MathTask>): string {
  return [
    task.title || '',
    task.original_text || '',
    (task.solution_steps || []).join(' '),
    (task.tags || []).join(' '),
    task.curriculum_topic || '',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

/** Confidence below this is surfaced as a warning in the OCR preview. */
export const OCR_CONFIDENCE_WARNING_THRESHOLD = 70;

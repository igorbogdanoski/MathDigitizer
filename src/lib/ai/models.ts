/**
 * Centralized Gemini model configuration — single source of truth for every
 * model ID used across the app.
 *
 * Before this module existed, model strings were hardcoded in ~38 places in
 * gemini.ts (and a couple in components), so adding or swapping a model meant
 * hunting through the god-object. Import from here instead — and only from
 * here: `models.test.ts` fails the build if a model id is written anywhere
 * else. That guard exists because four call sites had already drifted back to
 * literals, and one of them was still asking for the oldest flash preview
 * months after the default had moved on twice.
 *
 * Availability verified against the Gemini API `models` endpoint for the
 * project's API key (2026-09-03): 54 models, of which the pro tier still ships
 * only as `gemini-3.1-pro-preview` — there is no stable 3.x pro, so the
 * `-preview` suffix on PRO_MODEL is correct rather than stale.
 */

// ─── Generation / reasoning models ───────────────────────────────────────────

/** Highest-quality reasoning model — extraction, pedagogy, spatial multimodal. */
export const PRO_MODEL = 'gemini-3.1-pro-preview';

/** Default workhorse for most generation tasks (balanced quality/speed/cost). */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** Previous default. Kept because the video pipeline pins it deliberately. */
export const FLASH_35_MODEL = 'gemini-3.5-flash';

export const FLASH_36_MODEL = 'gemini-3.6-flash';

/** Long-context agentic worker for the segmented video pipeline. */
export const FLASH_37_MODEL = 'gemini-3.7-flash';

/** Legacy fast preview model — kept as a selectable "Fast" option in the UI. */
export const FAST_MODEL = 'gemini-3-flash-preview';

/** Economy tier — cheapest/fastest, for high-volume batch operations. */
export const LITE_MODEL = 'gemini-3.5-flash-lite';

// ─── Specialized models ──────────────────────────────────────────────────────

/** Text-to-speech (audio output). */
export const TTS_MODEL = 'gemini-3.1-flash-tts-preview';

/** Image generation. */
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

/** Text embeddings for RAG / semantic search. */
export const EMBEDDING_MODEL = 'gemini-embedding-2';

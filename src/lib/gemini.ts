/**
 * @deprecated Import from './ai' instead. This file used to be a ~2974-line
 * god-object; every function body now lives in a domain module under
 * `src/lib/ai/` (extraction.ts, grading.ts, generation.ts, materials.ts,
 * media.ts, chat.ts, kahoot.ts, embeddings.ts, utils.ts) with the shared
 * Gemini client in `src/lib/ai/client.ts`.
 *
 * This file is kept ONLY as a backward-compatibility re-export layer because
 * ~160 components still `import { ... } from '../lib/gemini'`. Do not add new
 * code here — add it to the appropriate `src/lib/ai/` domain module.
 */
export * from './ai/client';
export * from './ai/extraction';
export * from './ai/curriculum';
export * from './ai/grading';
export * from './ai/generation';
export * from './ai/materials';
export * from './ai/media';
export * from './ai/chat';
export * from './ai/kahoot';
export * from './ai/embeddings';
export * from './ai/classification';
export * from './ai/videoAgent';
export * from './ai/utils';

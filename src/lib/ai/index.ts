/**
 * AI module — centralized exports for all Gemini AI functions.
 * 
 * Architecture (Phase 4 complete):
 * - client.ts: Shared Gemini client setup (ai proxy, error handling)
 * - extraction.ts: Extract math tasks from PDF/URL/images
 * - grading.ts: Grade and analyze student work
 * - generation.ts: Generate new math content
 * - materials.ts: Generate educational materials
 * - media.ts: Generate images, speech, graphics
 * - chat.ts: Tutoring and Socratic simulations
 * - kahoot.ts: Kahoot-style quiz generation
 * - embeddings.ts: Text embeddings for RAG
 * - utils.ts: Utility functions
 * 
 * Usage:
 *   import { extractMathTasksFromPdf, generateSimilarTask } from './ai';
 *   import { ai, handleGeminiError } from './ai/client';
 */

// Shared client utilities
export { ai, handleGeminiError, buildCurriculumContextBlock, apiUrl, postJson } from './client';

// Domain modules
export * from './extraction';
export * from './grading';
export * from './generation';
export * from './materials';
export * from './media';
export * from './chat';
export * from './kahoot';
export * from './embeddings';
export * from './utils';

// Re-export everything from gemini.ts for backward compatibility
// (includes any functions not yet categorized into domain modules)
export * from '../gemini';

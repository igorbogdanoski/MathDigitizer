/**
 * Shared Gemini AI client setup.
 * Extracted from gemini.ts god-object — see DEVELOPMENT_PLAN Phase 4.
 */
import { GoogleGenAI } from "@google/genai";

// ─── Curriculum RAG helper (no extra API call) ───────────────────────────────
//
// The corpus is loaded on demand rather than imported at module scope. It is
// 571 KB of curriculum prose, and this module is on the import path of nearly
// every feature — a static import put the whole corpus into every route bundle,
// including ones that never build curriculum context at all.
export async function buildCurriculumContextBlock(query: string, gradeHint?: string): Promise<string> {
  const { searchCurriculumKeyword, buildCurriculumChunkText, ALL_MK_CURRICULUM } =
    await import("../curriculumData");

  // The grade restricts which programme is searched; it is not a search term.
  // Appending it to the query — which is what this did — scored every topic
  // that merely mentioned that number higher, and still searched all 31
  // programmes, so a third-grade task could be "aligned" against gymnasium
  // outcomes that the prompt then presented to the model as mandatory.
  const { resolveGradeToken } = await import('../curriculumGrade');
  const gradeToken = resolveGradeToken(gradeHint);

  const topics = searchCurriculumKeyword(query, gradeToken ?? undefined);
  if (topics.length === 0) return '';

  const lines = [
    '╔══ ОФИЦИЈАЛНА НАСТАВНА ПРОГРАМА — БРО.ГОВ.МК ══╗',
    'Задачата МОРА да биде усогласена со следните официјални исходи:',
    '',
  ];
  topics.slice(0, 3).forEach(topic => {
    const grade = ALL_MK_CURRICULUM.find(g => g.topics.some(t => t.id === topic.id));
    if (!grade) return;
    lines.push(buildCurriculumChunkText(grade, topic));
    lines.push('');
  });
  lines.push('╚═════════════════════════════════════════════════╝');
  return lines.join('\n');
}

// ─── API Base URL ────────────────────────────────────────────────────────────
function getApiBaseUrl(): string {
  const base = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  return base ? base.replace(/\/$/, '') : '';
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

// Get Firebase ID token for authenticated API requests
async function getAuthToken(): Promise<string | null> {
  try {
    const { auth } = await import('../firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (e) {
    console.warn('Failed to get auth token:', e);
  }
  return null;
}

export async function postJson(url: string, payload: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Add auth token for /api/ai/* routes
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(url), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {})
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Proxy call failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

function createBrowserProxyClient() {
  return {
    models: {
      generateContent: (payload: any) => postJson('/api/ai/generate-content', payload),
      embedContent: (payload: any) => postJson('/api/ai/embed-content', payload),
    },
    chats: {
      create: async (payload: any) => {
        const { chatId } = await postJson('/api/ai/chats/create', payload);
        return {
          sendMessage: (messagePayload: any) =>
            postJson(`/api/ai/chats/${encodeURIComponent(chatId)}/send-message`, messagePayload)
        };
      }
    }
  };
}

// ─── Client initialization ───────────────────────────────────────────────────
let _aiInstance: any = null;
let cachedApiKey: string | undefined = undefined;

try {
  // @ts-ignore
  cachedApiKey = process.env.GEMINI_API_KEY ?? import.meta.env?.VITE_GEMINI_API_KEY;
} catch (e) {}

const initAiPromise = (async () => {
  // NOTE: We intentionally do NOT fetch the API key from the server. The old
  // `/api/config` endpoint exposed the raw server GEMINI_API_KEY to any client
  // and has been removed. The key now comes only from build-time env
  // (VITE_GEMINI_API_KEY, referrer-restricted, for static hosting); when it is
  // absent we fall back to the authenticated `/api/ai/*` proxy below.
  if (cachedApiKey && cachedApiKey !== "undefined") {
    _aiInstance = new GoogleGenAI({ apiKey: cachedApiKey });
    return;
  }

  if (typeof window !== 'undefined') {
    _aiInstance = createBrowserProxyClient();
    return;
  }

  _aiInstance = new GoogleGenAI({ apiKey: "missing_key" });
})();

export const ai: any = new Proxy({}, {
  get(target, prop) {
    if (prop === 'models' || prop === 'chats') {
      return new Proxy({}, {
        get(mTarget, mProp) {
          return async (...args: any[]) => {
            await initAiPromise;
            const call = () => _aiInstance[prop][mProp].apply(_aiInstance[prop], args);
            if (prop === 'models' && RETRYABLE_MODEL_METHODS.has(String(mProp))) return withRetry(call);
            return call();
          };
        }
      });
    }
    return async (...args: any[]) => {
      await initAiPromise;
      if (typeof _aiInstance[prop] === 'function') {
        return _aiInstance[prop].apply(_aiInstance, args);
      }
      return _aiInstance[prop];
    };
  }
});

// ─── Retry with exponential backoff ─────────────────────────────────────────
// Central retry for transient Gemini/transport failures (quota windows,
// 5xx, network blips). 4xx like 404 (unknown model) are NOT retried so model
// fallbacks (e.g. videoAgent's 3.7→3.6) still trigger immediately.
const RETRYABLE_ERROR = /429|50[0-9]|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|ECONNRESET|fetch failed|network/i;

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 800): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!RETRYABLE_ERROR.test(msg) || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}

const RETRYABLE_MODEL_METHODS = new Set(['generateContent', 'embedContent']);

export function handleGeminiError(error: any): never {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("Надминат е лимитот кон серверите на Gemini AI (Quota/Rate Limit Exceeded). Обидете се повторно за неколку минути или изберете го побрзиот модел 'Gemini 3 Flash' од напредните опции.");
  }
  throw new Error(msg);
}

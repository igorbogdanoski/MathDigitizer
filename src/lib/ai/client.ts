/**
 * Shared Gemini AI client setup.
 * Extracted from gemini.ts god-object — see DEVELOPMENT_PLAN Phase 4.
 */
import { GoogleGenAI } from "@google/genai";

// ─── Curriculum RAG helper (synchronous — no extra API call) ─────────────────
import { searchCurriculumKeyword, buildCurriculumChunkText, ALL_MK_CURRICULUM } from "../curriculumData";

export function buildCurriculumContextBlock(query: string, gradeHint?: string): string {
  const topics = searchCurriculumKeyword(query + (gradeHint ? ` ${gradeHint}` : ''));
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

export async function postJson(url: string, payload: any) {
  const response = await fetch(apiUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  if (!cachedApiKey || cachedApiKey === "undefined") {
    try {
      const hasHttpOrigin =
        typeof window !== 'undefined' &&
        typeof window.location?.origin === 'string' &&
        /^https?:\/\//i.test(window.location.origin);
      const isTestRuntime = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

      if (hasHttpOrigin && !isTestRuntime) {
        const configUrl = new URL(`/api/config?_cb=${Date.now()}`, window.location.origin).toString();
        const res = await fetch(configUrl);
        if (res.ok) {
          const text = await res.text();
          if (!text.startsWith('<')) {
            const data = JSON.parse(text);
            cachedApiKey = data.apiKey;
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch API key from server", e);
    }
  }

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
            return _aiInstance[prop][mProp].apply(_aiInstance[prop], args);
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

export function handleGeminiError(error: any): never {
  const msg = error instanceof Error ? error.message : JSON.stringify(error);
  if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("Надминат е лимитот кон серверите на Gemini AI (Quota/Rate Limit Exceeded). Обидете се повторно за неколку минути или изберете го побрзиот модел 'Gemini 3 Flash' од напредните опции.");
  }
  throw new Error(msg);
}

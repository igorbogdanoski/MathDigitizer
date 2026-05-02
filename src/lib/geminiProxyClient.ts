type JsonPayload = Record<string, unknown>;

const postGemini = async (method: string, payload: JsonPayload) => {
  const response = await fetch(`/api/gemini/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Gemini proxy request failed with status ${response.status}`,
    );
  }

  return data;
};

export class GoogleGenAI {
  constructor(_options?: { apiKey?: string }) {}

  models = {
    generateContent: (payload: JsonPayload) => postGemini("generateContent", payload),
    embedContent: (payload: JsonPayload) => postGemini("embedContent", payload),
  };

  chats = {
    create: (options: JsonPayload) => createChatSession(options),
  };

  getGenerativeModel(options: JsonPayload) {
    return {
      startChat: (chatOptions: JsonPayload = {}) => createChatSession({
        model: options.model,
        config: {
          ...(typeof options.generationConfig === "object" ? options.generationConfig : {}),
          ...(typeof chatOptions.generationConfig === "object" ? chatOptions.generationConfig : {}),
        },
        history: Array.isArray(chatOptions.history) ? chatOptions.history : [],
      }),
    };
  }
}

function extractMessage(input: unknown) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "message" in input) {
    return String((input as { message: unknown }).message || "");
  }
  return String(input || "");
}

function createChatSession(options: JsonPayload) {
  const history = Array.isArray(options.history) ? [...options.history] : [];
  const model = typeof options.model === "string" ? options.model : "gemini-3.1-pro-preview";
  const config = typeof options.config === "object" && options.config ? options.config : {};

  return {
    async sendMessage(input: unknown) {
      const message = extractMessage(input);
      history.push({ role: "user", parts: [{ text: message }] });
      const response = await postGemini("generateContent", {
        model,
        contents: history,
        config,
      });
      history.push({ role: "model", parts: [{ text: response.text || "" }] });
      return {
        ...response,
        response,
      };
    },
  };
}

export const Type = {
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
} as const;

export const Modality = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  AUDIO: "AUDIO",
} as const;

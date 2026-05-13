import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
];

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return true;
  const allowlist = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowlist.includes(origin);
}

function parseSafeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function isPublicConfigEndpointEnabled(): boolean {
  const flag = String(process.env.ALLOW_PUBLIC_API_CONFIG || "").toLowerCase();
  return flag === "1" || flag === "true";
}

let serverAiClient: any = null;
const serverChatSessions = new Map<string, any>();

async function getServerAiClient() {
  if (serverAiClient) return serverAiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on server");
  }
  const { GoogleGenAI } = await import("@google/genai");
  serverAiClient = new GoogleGenAI({ apiKey });
  return serverAiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin || undefined)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin denied"));
      },
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected to socket:", socket.id);

    socket.on("join-room", (roomId) => {
      if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{3,80}$/.test(roomId)) {
        return;
      }
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("canvas-event", ({ roomId, event }) => {
      if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{3,80}$/.test(roomId)) {
        return;
      }
      socket.to(roomId).emit("canvas-event", event);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Public key config endpoint is disabled by default in production.
  // Enable only when strictly needed via ALLOW_PUBLIC_API_CONFIG=true.
  app.get("/api/config", (req, res) => {
    const enabled = isPublicConfigEndpointEnabled();
    if (!enabled) {
      return res.status(404).json({ error: "Not found" });
    }

    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: "Origin not allowed" });
    }

    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
  });

  app.post("/api/ai/generate-content", async (req, res) => {
    try {
      const client = await getServerAiClient();
      const response = await client.models.generateContent(req.body || {});
      return res.json(response);
    } catch (error: any) {
      console.error("[AI Proxy] generate-content failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy generate-content failed" });
    }
  });

  app.post("/api/ai/embed-content", async (req, res) => {
    try {
      const client = await getServerAiClient();
      const response = await client.models.embedContent(req.body || {});
      return res.json(response);
    } catch (error: any) {
      console.error("[AI Proxy] embed-content failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy embed-content failed" });
    }
  });

  app.post("/api/ai/chats/create", async (req, res) => {
    try {
      const client = await getServerAiClient();
      const chat = await client.chats.create(req.body || {});
      const chatId = crypto.randomUUID();
      serverChatSessions.set(chatId, chat);
      if (serverChatSessions.size > 200) {
        const oldest = serverChatSessions.keys().next().value;
        if (oldest) serverChatSessions.delete(oldest);
      }
      return res.json({ chatId });
    } catch (error: any) {
      console.error("[AI Proxy] chats.create failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy chats.create failed" });
    }
  });

  app.post("/api/ai/chats/:chatId/send-message", async (req, res) => {
    try {
      const { chatId } = req.params;
      const chat = serverChatSessions.get(chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      const response = await chat.sendMessage(req.body || {});
      return res.json(response);
    } catch (error: any) {
      console.error("[AI Proxy] chat.sendMessage failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy chat.sendMessage failed" });
    }
  });

  // Free YouTube Transcript API
  app.get("/api/youtube/transcript", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Недостасува 'url' параметарот" });
    }

    const parsed = parseSafeUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: "Невалиден URL" });
    }
    const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"]);
    if (!youtubeHosts.has(parsed.hostname.toLowerCase())) {
      return res.status(400).json({ error: "Дозволени се само YouTube URL-а" });
    }

    try {
      console.log(`[YoutubeScraper] Fetching transcript for: ${url}`);
      const module = await import("youtube-transcript") as any;
      const YoutubeTranscript = module.YoutubeTranscript || module.default?.YoutubeTranscript || module.default;
      
      let transcript;
      try {
        transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'mk' });
        console.log(`[YoutubeScraper] Successful extraction using 'mk' language.`);
      } catch (errMk) {
        console.log(`[YoutubeScraper] Language 'mk' failed, trying 'en'...`);
        try {
          transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
          console.log(`[YoutubeScraper] Successful extraction using 'en' language.`);
        } catch (errEn) {
          console.log(`[YoutubeScraper] Language 'en' failed, fetching default transcript...`);
          transcript = await YoutubeTranscript.fetchTranscript(url);
          console.log(`[YoutubeScraper] Successful extraction using default language.`);
        }
      }
      
      // Combine texts into a single block
      const fullText = transcript.map((t: any) => t.text).join(" ");
      
      return res.json({ 
        url,
        transcript: fullText,
        fragments: transcript
      });
    } catch (error: any) {
      console.error("[YoutubeScraper] Error:", error.message || error);
      return res.status(500).json({ 
        error: "Не можам да го извлечам транскриптот. Видеото можеби нема превод или е приватно."
      });
    }
  });

  // Generic Web Scraper API
  app.get("/api/scrape", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Недостасува 'url' параметарот" });
    }

    const parsed = parseSafeUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: "Невалиден URL" });
    }
    if (isPrivateHost(parsed.hostname)) {
      return res.status(400).json({ error: "Овој URL не е дозволен" });
    }

    try {
      console.log(`[WebScraper] Fetching content from: ${url}`);
      const fetchResponse = await fetch(parsed.toString(), {
        signal: withTimeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch status: ${fetchResponse.status}`);
      }

      const html = await fetchResponse.text();
      const cheerio = await import("cheerio");
      
      const $ = cheerio.load(html);
      
      // Remove scripts, styles, nav, footer to get core content
      $('script, style, noscript, nav, footer, header, aside').remove();
      
      const title = $('title').text() || $('h1').first().text();
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // Safety limit for context (roughly 20k characters)
      if (text.length > 20000) {
        text = text.substring(0, 20000) + "... (кратено)";
      }

      return res.json({ 
        url,
        title: title.trim(),
        content: text
      });
    } catch (error: any) {
      console.error("[WebScraper] Error:", error.message || error);
      return res.status(500).json({ 
        error: "Не можам да ја извлечам содржината од овој веб-сајт."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: Use explicit dist paths and fallbacks for production 
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

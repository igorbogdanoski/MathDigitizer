import "dotenv/config";
import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import net from "net";
import { promises as dns } from "dns";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai";

const MAX_JSON_BODY = "25mb";
const MAX_SCRAPE_BYTES = 1_000_000;
const SCRAPE_TIMEOUT_MS = 10_000;

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.APP_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isPrivateAddress(address: string) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return true;
}

async function validatePublicHttpUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local network URLs are not allowed.");
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Private network URLs are not allowed.");
  }

  return parsed.toString();
}

function normalizeGeminiResponse(response: any) {
  const text =
    typeof response?.text === "function"
      ? response.text()
      : typeof response?.text === "string"
        ? response.text
        : undefined;

  return {
    text,
    candidates: response?.candidates,
    embeddings: response?.embeddings,
    embedding: response?.embedding,
    usageMetadata: response?.usageMetadata,
    modelVersion: response?.modelVersion,
    responseId: response?.responseId,
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const distPath = path.join(process.cwd(), "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPath);
  const allowedOrigins = getAllowedOrigins();
  const server = http.createServer(app);
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin || !isProduction || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Socket origin is not allowed."));
      },
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-room", (roomId) => {
      if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(roomId)) {
        return;
      }
      socket.join(roomId);
    });

    socket.on("canvas-event", ({ roomId, event }) => {
      if (typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(roomId)) {
        return;
      }
      if (JSON.stringify(event || {}).length > 50_000) {
        return;
      }
      socket.to(roomId).emit("canvas-event", event);
    });
  });

  app.use(express.json({ limit: MAX_JSON_BODY }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/gemini/:method", async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
    }

    const method = req.params.method;
    if (method !== "generateContent" && method !== "embedContent") {
      return res.status(404).json({ error: "Unsupported Gemini method." });
    }

    try {
      const response = await (gemini.models as any)[method](req.body);
      return res.json(normalizeGeminiResponse(response));
    } catch (error: any) {
      console.error(`[GeminiProxy] ${method} failed:`, error?.message || error);
      return res.status(502).json({
        error: error?.message || "Gemini request failed.",
      });
    }
  });

  app.get("/api/youtube/transcript", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url parameter." });
    }

    try {
      const module = (await import("youtube-transcript")) as any;
      const YoutubeTranscript =
        module.YoutubeTranscript || module.default?.YoutubeTranscript || module.default;
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const fullText = transcript.map((item: any) => item.text).join(" ");

      return res.json({
        url,
        transcript: fullText,
        fragments: transcript,
      });
    } catch (error: any) {
      console.error("[YoutubeScraper] Error:", error?.message || error);
      return res.status(500).json({
        error: "Could not extract the transcript.",
        details: error?.message,
      });
    }
  });

  app.get("/api/scrape", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url parameter." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

    try {
      const safeUrl = await validatePublicHttpUrl(url);
      const fetchResponse = await fetch(safeUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "MathDigitizerBot/1.0",
        },
      });

      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch status: ${fetchResponse.status}`);
      }

      const contentLength = Number(fetchResponse.headers.get("content-length") || 0);
      if (contentLength > MAX_SCRAPE_BYTES) {
        throw new Error("Remote page is too large.");
      }

      const html = await fetchResponse.text();
      if (html.length > MAX_SCRAPE_BYTES) {
        throw new Error("Remote page is too large.");
      }

      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer, header, aside").remove();

      const title = $("title").text() || $("h1").first().text();
      let text = $("body").text().replace(/\s+/g, " ").trim();
      if (text.length > 20_000) {
        text = `${text.substring(0, 20_000)}... (truncated)`;
      }

      return res.json({
        url: safeUrl,
        title: title.trim(),
        content: text,
      });
    } catch (error: any) {
      console.error("[WebScraper] Error:", error?.message || error);
      return res.status(400).json({
        error: error?.message || "Could not extract page content.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();

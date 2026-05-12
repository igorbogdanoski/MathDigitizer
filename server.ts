import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected to socket:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on("canvas-event", ({ roomId, event }) => {
      socket.to(roomId).emit("canvas-event", event);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Middleware
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Expose API Key to frontend (Required since Vite build time misses it for deployment)
  app.get("/api/config", (req, res) => {
    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
  });

  // Free YouTube Transcript API
  app.get("/api/youtube/transcript", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Недостасува 'url' параметарот" });
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
        error: "Не можам да го извлечам транскриптот. Видеото можеби нема превод или е приватно.",
        details: error.message
      });
    }
  });

  // Generic Web Scraper API
  app.get("/api/scrape", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Недостасува 'url' параметарот" });
    }

    try {
      console.log(`[WebScraper] Fetching content from: ${url}`);
      const fetchResponse = await fetch(url, {
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
        error: "Не можам да ја извлечам содржината од овој веб-сајт.",
        details: error.message
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

import express from "express";
import path from "path";
import http from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

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
      // Dynamically import ESM to avoid node CJS/ESM conflicts
      const { YoutubeTranscript } = await import("youtube-transcript/dist/youtube-transcript.esm.js");
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      
      // Combine texts into a single block
      const fullText = transcript.map(t => t.text).join(" ");
      
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

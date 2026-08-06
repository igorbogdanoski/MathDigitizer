import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { Server } from "socket.io";
import * as admin from "firebase-admin";
import {
  toSharedTask,
  toSharedTaskExport,
  sharedTasksToLatex,
  sharedTasksToMarkdown,
} from "./src/lib/sharedTaskFormat";
import { taskToSlides } from "./src/lib/slidesExport";
import { tasksByCurriculum } from "./src/lib/curriculumExport";
import { tasksToSlideaDocument } from "./src/lib/slideaInterchange";
import { MathTask } from "./src/lib/schema";
import { mergeBillingActivity } from "./src/lib/billing";

// ─── Firebase Admin Initialization ───────────────────────────────────────────
// Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account
// JSON file, or FIREBASE_SERVICE_ACCOUNT_JSON env var with the JSON content.
let firebaseAdminInitialized = false;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseAdminInitialized = true;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    firebaseAdminInitialized = true;
  }
} catch (e) {
  console.warn("[Firebase Admin] Failed to initialize:", e);
}

// Authentication middleware for /api/ai/* routes
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!firebaseAdminInitialized) {
    // Fail CLOSED in production: if Firebase Admin isn't configured we must
    // NOT let anonymous traffic through the AI proxy (it would let anyone
    // spend our Gemini quota). The permissive fallback is dev-only.
    if (process.env.NODE_ENV === "production") {
      console.error("[Auth] Firebase Admin not configured in production — rejecting request");
      return res.status(503).json({ error: "Auth service unavailable" });
    }
    console.warn("[Auth] Firebase Admin not configured — allowing unauthenticated request (dev only)");
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error("[Auth] Token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Cross-App Export API helpers ────────────────────────────────────────────

let APP_VERSION = "0.0.0";
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  if (typeof pkg.version === "string") APP_VERSION = pkg.version;
} catch {
  // keep the fallback version
}

/**
 * Fixed-window in-memory rate limit for the export endpoints:
 * 120 requests / minute per IP. Keeps sibling apps honest without adding a
 * dependency (see docs/CROSS_APP_API.md §Rate limits).
 */
const EXPORT_RATE_LIMIT_MAX = 120;
const EXPORT_RATE_WINDOW_MS = 60_000;
const exportRateBuckets = new Map<string, { count: number; resetAt: number }>();

function exportRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (exportRateBuckets.size > 5000) {
    for (const [ip, bucket] of exportRateBuckets) {
      if (now > bucket.resetAt) exportRateBuckets.delete(ip);
    }
  }

  let bucket = exportRateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + EXPORT_RATE_WINDOW_MS };
    exportRateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > EXPORT_RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ error: "Rate limit exceeded — max 120 requests/minute" });
  }
  next();
}

/** Hard ceiling on how many task docs a single export query may scan. */
const EXPORT_SCAN_CAP = 1000;
const EXPORT_MAX_PAGE = 200;
const EXPORT_MAX_BATCH = 100;

// Firestore docs are validated by firestore.rules (isValidTask) before they
// are written, so reading them back as MathTask matches the client's approach
// (see useRealtimeTasks).
type RawTask = MathTask & { id: string };

/**
 * Fetch tasks from the shared `tasks` collection with equality filters.
 * Firestore allows combining multiple equality filters without composite
 * indexes; ordering/pagination happens in memory after the scan so we never
 * need an index for every filter combination. The `topic` filter matches
 * either `curriculum_topic` or a tag, so it is always applied in memory.
 */
async function fetchExportTasks(filters: {
  grade?: string;
  topic?: string;
  difficulty?: string;
  type?: string;
}): Promise<RawTask[]> {
  const db = admin.firestore();
  let query: admin.firestore.Query = db.collection("tasks");
  if (filters.grade) query = query.where("grade_level", "==", filters.grade);
  if (filters.difficulty) query = query.where("difficulty", "==", filters.difficulty);
  if (filters.type) query = query.where("type", "==", filters.type);

  const snap = await query.limit(EXPORT_SCAN_CAP).get();
  let tasks: RawTask[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RawTask);

  if (filters.topic) {
    const topic = filters.topic;
    tasks = tasks.filter(
      (t) => t.curriculum_topic === topic || (Array.isArray(t.tags) && t.tags.includes(topic))
    );
  }

  tasks.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return tasks;
}

/** 503 guard for endpoints that need Firestore via Firebase Admin. */
function requireFirestore(res: express.Response): boolean {
  if (!firebaseAdminInitialized) {
    res.status(503).json({ error: "Firebase Admin not configured" });
    return false;
  }
  return true;
}

function queryStringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

// Cross-app export API consumers (see docs/CROSS_APP_API.md):
//   - ai.mismath.net    → math-curriculum-ai-navigator
//   - slides.mismath.net → mkd-slidea
const DEFAULT_ALLOWED_ORIGINS = [
  "https://math.mismath.net",
  "https://ai.mismath.net",
  "https://slides.mismath.net",
];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  // Link-local, including the AWS/GCP/Azure cloud metadata endpoint
  // (169.254.169.254) — previously not blocked at all.
  /^169\.254\./,
  /^\[::1\]$/,
  /^\[::ffff:127\./,
  /^\[fe80:/i,
  /^\[fc[0-9a-f]{2}:/i,
  /^\[fd[0-9a-f]{2}:/i,
];

// See api/_shared.ts's isSuspiciousNumericHost for the rationale — kept in
// sync between the two backend implementations of this same check.
function isSuspiciousNumericHost(hostname: string): boolean {
  if (/^\d+$/.test(hostname)) return true;
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  const labels = hostname.split(".");
  const isNumericLabel = (label: string) => /^0x[0-9a-f]+$/i.test(label) || /^\d+$/.test(label);
  if (!labels.every(isNumericLabel)) return false; // has a real (non-numeric) label — a normal domain
  if (labels.some((label) => /^0x/i.test(label) || (/^0\d/.test(label) && label !== "0"))) return true;
  return labels.length !== 4;
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  const raw = process.env.ALLOWED_ORIGINS;
  const allowlist = raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  // Fail closed (matches api/_shared.ts) rather than allowing any origin
  // when ALLOWED_ORIGINS isn't set — this previously defaulted open, which
  // is dangerous for the unauthenticated endpoints below.
  return allowlist.includes(origin) || origin === "http://localhost:3000";
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
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized)) || isSuspiciousNumericHost(normalized);
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
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
  app.get("/api/health", async (req, res) => {
    let tasksCount = 0;
    if (firebaseAdminInitialized) {
      try {
        const countSnap = await admin.firestore().collection("tasks").count().get();
        tasksCount = countSnap.data().count;
      } catch (error: any) {
        console.warn("[Health] task count failed:", error?.message || error);
      }
    }
    res.json({
      status: "ok",
      version: APP_VERSION,
      api_version: "1.0",
      tasks_count: tasksCount,
    });
  });

  // ─── Cross-App Export API (see docs/CROSS_APP_API.md) ─────────────────────
  // Serves the SharedTask format (src/lib/sharedTaskFormat.ts) to
  // ai.mismath.net and slides.mismath.net. All routes require a Firebase
  // ID token (Authorization: Bearer <token>) and are rate limited.

  /**
   * GET /api/export/tasks
   * List tasks with filters.
   * Query: grade, topic, difficulty, type, limit, offset, format=json|latex|markdown
   * Returns: { tasks: SharedTask[], total: number } (json) or text for latex/markdown.
   */
  app.get("/api/export/tasks", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const grade = queryStringParam(req.query.grade);
      const topic = queryStringParam(req.query.topic);
      const difficulty = queryStringParam(req.query.difficulty);
      const type = queryStringParam(req.query.type);
      const format = (queryStringParam(req.query.format) || "json").toLowerCase();

      if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
        return res.status(400).json({ error: "difficulty must be easy|medium|hard" });
      }
      if (type && !["task", "theory"].includes(type)) {
        return res.status(400).json({ error: "type must be task|theory" });
      }
      if (!["json", "latex", "markdown"].includes(format)) {
        return res.status(400).json({ error: "format must be json|latex|markdown" });
      }

      const limitRaw = Number.parseInt(queryStringParam(req.query.limit) || "50", 10);
      const offsetRaw = Number.parseInt(queryStringParam(req.query.offset) || "0", 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), EXPORT_MAX_PAGE) : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const all = await fetchExportTasks({ grade, topic, difficulty, type });
      const page = all.slice(offset, offset + limit);
      const shared = page.map((t) => toSharedTask(t));

      if (format === "latex") {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.send(sharedTasksToLatex(shared));
      }
      if (format === "markdown") {
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        return res.send(sharedTasksToMarkdown(shared));
      }
      return res.json({ tasks: shared, total: all.length });
    } catch (error: any) {
      console.error("[Export] tasks list failed:", error?.message || error);
      return res.status(500).json({ error: "Failed to list tasks" });
    }
  });

  /**
   * GET /api/export/tasks/:id
   * Single task detail as SharedTask.
   */
  app.get("/api/export/tasks/:id", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const taskId = typeof req.params.id === "string" ? req.params.id : undefined;
      if (!taskId || taskId.length > 200) {
        return res.status(400).json({ error: "Invalid task id" });
      }

      const docSnap = await admin.firestore().collection("tasks").doc(taskId).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Task not found" });
      }
      return res.json(toSharedTask({ id: docSnap.id, ...docSnap.data()! } as RawTask));
    } catch (error: any) {
      console.error("[Export] task detail failed:", error?.message || error);
      return res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  /**
   * POST /api/export/batch
   * Export specific task ids as a SharedTaskExport envelope.
   * Body: { taskIds: string[], format: 'json' | 'slides' | 'curriculum' }
   */
  app.post("/api/export/batch", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const { taskIds, format } = (req.body || {}) as { taskIds?: unknown; format?: unknown };
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds must be a non-empty array" });
      }
      if (taskIds.length > EXPORT_MAX_BATCH) {
        return res.status(400).json({ error: `Maximum ${EXPORT_MAX_BATCH} tasks per batch` });
      }
      const ids = taskIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200);
      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid task ids provided" });
      }
      const batchFormat = typeof format === "string" ? format : "json";
      if (!["json", "slides", "curriculum"].includes(batchFormat)) {
        return res.status(400).json({ error: "format must be json|slides|curriculum" });
      }

      const db = admin.firestore();
      const refs = ids.map((id) => db.collection("tasks").doc(id));
      const snaps = await db.getAll(...refs);
      const tasks: RawTask[] = [];
      for (const snap of snaps) {
        if (snap.exists) tasks.push({ id: snap.id, ...snap.data()! } as RawTask);
      }

      const target = batchFormat === "slides" ? "slides" : batchFormat === "curriculum" ? "ai-navigator" : "generic";
      return res.json(toSharedTaskExport(tasks, target));
    } catch (error: any) {
      console.error("[Export] batch failed:", error?.message || error);
      return res.status(500).json({ error: "Batch export failed" });
    }
  });

  /**
   * GET /api/export/slides/:taskId
   * Slide-ready format for slides.mismath.net. Each solution step becomes a
   * slide; the last step is emitted as the 'answer' slide.
   * Returns: { title, slides: [{ type: 'question'|'step'|'answer', content, latex? }] }
   */
  app.get("/api/export/slides/:taskId", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const taskId = typeof req.params.taskId === "string" ? req.params.taskId : undefined;
      if (!taskId || taskId.length > 200) {
        return res.status(400).json({ error: "Invalid task id" });
      }

      const docSnap = await admin.firestore().collection("tasks").doc(taskId).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Task not found" });
      }

      const deck = taskToSlides({ id: docSnap.id, ...docSnap.data()! } as RawTask);
      const slides = deck.slides
        .filter((s) => s.type === "question" || s.type === "step" || s.type === "answer")
        .map((s) => ({
          type: s.type,
          content: s.content,
          ...(s.latex && s.latex.length > 0 ? { latex: s.latex } : {}),
        }));

      return res.json({ title: deck.title, slides });
    } catch (error: any) {
      console.error("[Export] slides failed:", error?.message || error);
      return res.status(500).json({ error: "Slides export failed" });
    }
  });

  /**
   * GET /api/export/curriculum
   * Curriculum-organized export for ai.mismath.net — tasks grouped by
   * curriculum_refs.topic_id. Query: grade, track.
   * Returns: Record<topic_id, { topic_id, topic_name, grade, tasks: SharedTask[] }>
   */
  app.get("/api/export/curriculum", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const grade = queryStringParam(req.query.grade);
      const track = queryStringParam(req.query.track);

      const tasks = await fetchExportTasks({ grade });
      const grouped = tasksByCurriculum(tasks);

      if (track) {
        for (const key of Object.keys(grouped)) {
          const group = grouped[key];
          group.tasks = group.tasks.filter((t) =>
            t.curriculum_refs?.some((ref) => ref.education_track === track)
          );
          if (group.tasks.length === 0) delete grouped[key];
        }
      }

      return res.json(grouped);
    } catch (error: any) {
      console.error("[Export] curriculum failed:", error?.message || error);
      return res.status(500).json({ error: "Curriculum export failed" });
    }
  });

  /**
   * GET /api/export/slidea
   * Slidea Interchange Format for slides.mismath.net — tasks converted to
   * the Slidea import format with БРО outcome codes.
   * Query: grade, topic, title (optional document title).
   * Returns: SlideaInterchangeDocument
   */
  app.get("/api/export/slidea", requireAuth, exportRateLimit, async (req, res) => {
    try {
      if (!requireFirestore(res)) return;

      const grade = queryStringParam(req.query.grade);
      const title = queryStringParam(req.query.title);

      const tasks = await fetchExportTasks({ grade });
      if (tasks.length === 0) {
        return res.status(404).json({ error: "No tasks found for the given filters" });
      }

      const doc = tasksToSlideaDocument(tasks, title || undefined);
      return res.json(doc);
    } catch (error: any) {
      console.error("[Export] slidea failed:", error?.message || error);
      return res.status(500).json({ error: "Slidea export failed" });
    }
  });

  // ─── Billing API ────────────────────────────────────────────────────────────

  /**
   * POST /api/billing/verify-payment
   * Admin-only: approve or reject a payment receipt.
   * On approval, activates Pro for the user in Firestore.
   */
  app.post("/api/billing/verify-payment", requireAuth, async (req, res) => {
    try {
      if (!firebaseAdminInitialized) {
        return res.status(503).json({ error: "Firebase Admin not configured" });
      }

      const { receiptId, action, reviewNote } = req.body || {};
      if (!receiptId || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ error: "receiptId and action (approve|reject) are required" });
      }

      const adminUid = (req as any).user?.uid;
      const adminEmail = (req as any).user?.email;

      // Only allow admin emails to verify payments
      const adminAllowlist = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAIL || "")
        .split(",").map((e: string) => e.trim().toLowerCase()).filter(Boolean);
      if (!adminAllowlist.includes(adminEmail?.toLowerCase())) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const db = admin.firestore();
      const receiptRef = db.collection("payment_receipts").doc(receiptId);
      const receiptSnap = await receiptRef.get();

      if (!receiptSnap.exists) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const receipt = receiptSnap.data()!;
      const newStatus = action === "approve" ? "approved" : "rejected";

      await receiptRef.update({
        status: newStatus,
        reviewed_by: adminEmail,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote || "",
      });

      // Activate Pro on approval
      if (action === "approve" && receipt.requester_uid) {
        const userRef = db.collection("users").doc(receipt.requester_uid);
        await userRef.set({
          isPro: true,
          proStartedAt: new Date().toISOString(),
          paymentChannel: receipt.payment_channel || "bank",
        }, { merge: true });
      }

      return res.json({
        success: true,
        status: newStatus,
        proActivated: action === "approve",
      });
    } catch (error: any) {
      console.error("[Billing] verify-payment failed:", error?.message || error);
      return res.status(500).json({ error: "Payment verification failed" });
    }
  });

  /**
   * GET /api/billing/status
   * Returns the authenticated user's billing/subscription status.
   */
  app.get("/api/billing/status", requireAuth, async (req, res) => {
    try {
      if (!firebaseAdminInitialized) {
        return res.status(503).json({ error: "Firebase Admin not configured" });
      }

      const uid = (req as any).user?.uid;
      if (!uid) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const db = admin.firestore();
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.exists ? userSnap.data()! : {};

      const [receiptsSnap, intentsSnap] = await Promise.all([
        db.collection("payment_receipts")
          .where("requester_uid", "==", uid)
          .orderBy("created_at", "desc")
          .limit(20)
          .get(),
        db.collection("payment_intents")
          .where("user_id", "==", uid)
          .orderBy("created_at", "desc")
          .limit(20)
          .get(),
      ]);

      const receipts = receiptsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const intents = intentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const history = mergeBillingActivity(receipts, intents);

      const isPro = Boolean(userData.isPro);
      const trialStartedAt = userData.trialStartedAt as string | undefined;
      let trialDaysRemaining = 0;
      if (trialStartedAt && !isPro) {
        const elapsed = Math.floor((Date.now() - new Date(trialStartedAt).getTime()) / 86_400_000);
        trialDaysRemaining = Math.max(0, 7 - elapsed);
      }

      return res.json({
        isPro,
        trialDaysRemaining,
        proStartedAt: userData.proStartedAt || null,
        paymentChannel: userData.paymentChannel || null,
        receipts,
        intents,
        history,
      });
    } catch (error: any) {
      console.error("[Billing] status failed:", error?.message || error);
      return res.status(500).json({ error: "Failed to fetch billing status" });
    }
  });

  app.post("/api/ai/generate-content", requireAuth, async (req, res) => {
    try {
      const client = await getServerAiClient();
      const response = await client.models.generateContent(req.body || {});
      return res.json(response);
    } catch (error: any) {
      console.error("[AI Proxy] generate-content failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy generate-content failed" });
    }
  });

  app.post("/api/ai/embed-content", requireAuth, async (req, res) => {
    try {
      const client = await getServerAiClient();
      const response = await client.models.embedContent(req.body || {});
      return res.json(response);
    } catch (error: any) {
      console.error("[AI Proxy] embed-content failed:", error?.message || error);
      return res.status(500).json({ error: "AI proxy embed-content failed" });
    }
  });

  app.post("/api/ai/chats/create", requireAuth, async (req, res) => {
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

  app.post("/api/ai/chats/:chatId/send-message", requireAuth, async (req, res) => {
    try {
      const chatId = req.params.chatId as string;
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
        // Never auto-follow redirects — see api/scrape.ts for the rationale
        // (a URL that passes isPrivateHost on first fetch could otherwise
        // 3xx to a private/metadata address with no re-validation).
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (fetchResponse.status >= 300 && fetchResponse.status < 400) {
        throw new Error('Redirects are not followed for scrape targets');
      }
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch status: ${fetchResponse.status}`);
      }

      const html = await fetchResponse.text();
      const cheerio = await import("cheerio");

      const $ = cheerio.load(html);

      // Preserve math notation before stripping <script> tags: MathJax/KaTeX
      // source is commonly embedded as <script type="math/tex">...</script> or
      // similar — losing these left every scraped page with its formulas
      // silently deleted. Pull them out as inline $...$ markers first.
      $('script[type*="math/tex"], script[type="math/asciimath"], script[type="math/mml"]').each((_, el) => {
        const tex = $(el).text().trim();
        if (tex) {
          $(el).replaceWith(` $${tex}$ `);
        }
      });

      // Also preserve KaTeX rendered math (span.katex elements)
      $('.katex, .MathJax, .math').each((_, el) => {
        const annotation = $(el).find('annotation[encoding="application/x-tex"]').text();
        if (annotation) {
          $(el).replaceWith(` $${annotation}$ `);
        }
      });

      // Remove remaining scripts, styles, nav, footer to get core content
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

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Same allowlist approach as the old server.ts Express backend — the static
// site lives on a different origin (math.mismath.net, Hostinger) than these
// functions (Vercel), so CORS must be handled explicitly here.
const DEFAULT_ALLOWED_ORIGINS = ['https://math.mismath.net'];

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  const allowlist = getAllowedOrigins();

  // Allow same-origin/non-browser requests (no Origin header) and anything
  // on the allowlist. Also allow *.vercel.app preview deployments so PR
  // previews can exercise these functions during development.
  const isAllowed =
    !origin ||
    allowlist.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    origin === 'http://localhost:3000';

  if (origin && isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return false; // caller should stop, this was just a preflight
  }

  if (origin && !isAllowed) {
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }

  return true; // caller should proceed
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
];

export function parseSafeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

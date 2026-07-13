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
  // Link-local, including the AWS/GCP/Azure cloud metadata endpoint
  // (169.254.169.254) — previously not blocked at all.
  /^169\.254\./,
  // IPv6 loopback, link-local, and unique-local ranges. URL#hostname keeps
  // the brackets for IPv6 literals (e.g. "[::1]"), so match on that form.
  /^\[::1\]$/,
  /^\[::ffff:127\./,
  /^\[fe80:/i,
  /^\[fc[0-9a-f]{2}:/i,
  /^\[fd[0-9a-f]{2}:/i,
];

// Rejects alternate IP encodings that resolve to an IPv4 address but don't
// match the dotted-decimal patterns above by construction — e.g. decimal
// (2130706433), hex (0x7f000001), or octal (0177.0.0.1) forms of 127.0.0.1,
// or a dotted form with fewer/more than 4 octets. A hostname is only ever
// legitimately either a domain name or a plain 4-octet dotted-decimal IPv4
// address; anything else numeric-looking is treated as suspicious.
function isSuspiciousNumericHost(hostname: string): boolean {
  if (/^\d+$/.test(hostname)) return true; // pure decimal, e.g. 2130706433
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true; // hex, e.g. 0x7f000001
  const octets = hostname.split('.');
  if (octets.length > 1 && octets.length !== 4) return true; // malformed dotted form
  if (octets.some((o) => /^0x/i.test(o) || (/^0\d/.test(o) && o !== '0'))) return true; // per-octet hex/octal
  return false;
}

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
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized)) || isSuspiciousNumericHost(normalized);
}

export function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

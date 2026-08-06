import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_shared.js';
import { buildIngestionDiagnosticsReport } from '../../src/lib/ingestion/diagnostics';

function isAuthorized(req: VercelRequest): boolean {
  const requiredKey = process.env.INGESTION_DIAGNOSTICS_KEY;
  if (!requiredKey) return true;
  const provided = req.headers['x-admin-key'];
  return typeof provided === 'string' && provided === requiredKey;
}

function readIncludePreflight(req: VercelRequest): boolean {
  const raw = typeof req.query.preflight === 'string' ? req.query.preflight : undefined;
  if (!raw) return true;
  return raw.toLowerCase() !== 'false';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized diagnostics request' });
  }

  try {
    const includePreflight = readIncludePreflight(req);
    const report = await buildIngestionDiagnosticsReport({ includePreflight });
    return res.status(200).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown diagnostics error';
    return res.status(500).json({
      ok: false,
      error: message,
      generatedAt: new Date().toISOString(),
    });
  }
}
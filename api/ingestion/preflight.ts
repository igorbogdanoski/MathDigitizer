import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from '../_shared.js';
import { buildIngestionPreflightReport } from '../../src/lib/ingestion/preflight';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!applyCors(req, res)) return;

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const report = await buildIngestionPreflightReport();
    return res.status(200).json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown preflight error';
    return res.status(500).json({
      ok: false,
      error: message,
      generatedAt: new Date().toISOString(),
    });
  }
}

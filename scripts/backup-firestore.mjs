#!/usr/bin/env node
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGETS = {
  new: {
    saPath: resolve(__dirname, 'secrets', 'serviceAccount-new.json'),
    projectId: 'mathdigitizer-pro',
    databaseId: '(default)',
  },
  old: {
    saPath: resolve(__dirname, 'secrets', 'serviceAccount-old.json'),
    projectId: 'gen-lang-client-0956771496',
    databaseId: 'ai-studio-78b66c2e-8ca0-449c-8e89-6a89b72ffcef',
  },
};

const which = process.argv[2] === '--old' ? 'old' : 'new';
const cfg = TARGETS[which];

if (!existsSync(cfg.saPath)) {
  console.error(`Missing service account: ${cfg.saPath}`);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(cfg.saPath, 'utf-8'));
const app = initializeApp({ credential: cert(sa), projectId: cfg.projectId }, which);
const db = getFirestore(app, cfg.databaseId);

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = resolve(__dirname, 'backups', `backup-${which}-${stamp}`);
mkdirSync(outDir, { recursive: true });

console.log(`Backing up ${cfg.projectId} / ${cfg.databaseId}`);
console.log(`-> ${outDir}\n`);

function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return { __ts: value.toDate().toISOString() };
    }
    if (value._latitude !== undefined && value._longitude !== undefined) {
      return { __geo: [value._latitude, value._longitude] };
    }
    if (Array.isArray(value)) return value.map(serialize);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

async function backupCollection(colRef, relPath) {
  const snap = await colRef.get();
  if (snap.empty) return 0;
  const docs = [];
  for (const d of snap.docs) {
    docs.push({ id: d.id, data: serialize(d.data()) });
    const subCols = await d.ref.listCollections();
    for (const sc of subCols) {
      await backupCollection(sc, `${relPath}/${d.id}/${sc.id}`);
    }
  }
  const fp = resolve(outDir, `${relPath.replace(/\//g, '__')}.json`);
  writeFileSync(fp, JSON.stringify(docs, null, 2), 'utf-8');
  console.log(`  ${relPath} -> ${docs.length} docs`);
  return docs.length;
}

const collections = await db.listCollections();
let total = 0;
for (const c of collections) {
  total += await backupCollection(c, c.id);
}

const summary = { project: cfg.projectId, database: cfg.databaseId, timestamp: stamp, totalDocs: total };
writeFileSync(resolve(outDir, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nDONE. ${total} documents backed up to ${outDir}`);
process.exit(0);

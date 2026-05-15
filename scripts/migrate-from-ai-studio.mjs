#!/usr/bin/env node
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SECRETS_DIR = resolve(__dirname, 'secrets');

const OLD = {
  saPath: resolve(SECRETS_DIR, 'serviceAccount-old.json'),
  projectId: 'gen-lang-client-0956771496',
  databaseId: 'ai-studio-78b66c2e-8ca0-449c-8e89-6a89b72ffcef',
};

const NEW = {
  saPath: resolve(SECRETS_DIR, 'serviceAccount-new.json'),
  projectId: 'mathdigitizer-pro',
  databaseId: '(default)',
};

const UID_REMAP = {
  'd4iiaOKAEUhaIsBFd043oGLY': 'IdxzP9MruXWGrALINibf2FxPhiO2',
};

const COLLECTIONS = [
  'tasks',
  'flashcards',
  'user_stats',
  'classrooms',
  'assignments',
  'graded_submissions',
  'student_progress',
  'user_mastery',
  'payment_receipts',
  'whiteboard_sessions',
  'kahoot_sessions',
  'pedagogical_critiques',
  'school_inquiries',
  'users',
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const ONLY = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]?.split(',') ?? null;

function loadServiceAccount(path, label) {
  if (!existsSync(path)) {
    console.error(`\n[ERROR] Missing ${label} service account at:\n  ${path}\n`);
    console.error('Download from Firebase Console -> Project Settings -> Service Accounts -> "Generate new private key"');
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function getDb(saPath, projectId, databaseId, name) {
  const sa = loadServiceAccount(saPath, name);
  const app = initializeApp({ credential: cert(sa), projectId }, name);
  const db = getFirestore(app, databaseId);
  return db;
}

function fullKeyMatch(value) {
  if (typeof value !== 'string') return null;
  for (const [from, to] of Object.entries(UID_REMAP)) {
    if (value === from || value.startsWith(from)) return to;
  }
  return null;
}

function remapUidsDeep(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const mapped = fullKeyMatch(value);
    return mapped ?? value;
  }
  if (Array.isArray(value)) return value.map(remapUidsDeep);
  if (typeof value === 'object') {
    if (value._seconds !== undefined || value.toDate) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = remapUidsDeep(v);
    return out;
  }
  return value;
}

const BATCH_LIMITS = {
  tasks: 1,
  flashcards: 50,
};
const DEFAULT_BATCH = 200;

async function copyCollection(srcDb, dstDb, name) {
  const srcRef = srcDb.collection(name);
  const snap = await srcRef.get();
  if (snap.empty) {
    console.log(`  [${name}] empty -> skip`);
    return { read: 0, written: 0 };
  }

  const batchLimit = BATCH_LIMITS[name] ?? DEFAULT_BATCH;
  let written = 0;
  let failed = 0;
  let batch = dstDb.batch();
  let inBatch = 0;

  const flush = async () => {
    if (inBatch === 0) return;
    try {
      await batch.commit();
      written += inBatch;
    } catch (e) {
      console.error(`    batch commit failed (${inBatch} docs): ${e.message}`);
      failed += inBatch;
    }
    batch = dstDb.batch();
    inBatch = 0;
  };

  for (const doc of snap.docs) {
    const data = remapUidsDeep(doc.data());
    let dstId = doc.id;
    const mappedId = fullKeyMatch(dstId);
    if (mappedId) dstId = mappedId;

    const ref = dstDb.collection(name).doc(dstId);
    if (DRY_RUN) {
      written++;
      continue;
    }

    if (batchLimit === 1) {
      try {
        await ref.set(data, { merge: true });
        written++;
      } catch (e) {
        console.error(`    [${name}/${dstId}] write failed: ${e.message}`);
        failed++;
      }
      continue;
    }

    batch.set(ref, data, { merge: true });
    inBatch++;
    if (inBatch >= batchLimit) await flush();
  }

  if (!DRY_RUN && inBatch > 0) await flush();
  console.log(`  [${name}] read=${snap.size} ${DRY_RUN ? 'would-write' : 'written'}=${written}${failed ? ` failed=${failed}` : ''}`);
  return { read: snap.size, written };
}

async function copySubcollections(srcDb, dstDb, parentCollection) {
  const parents = await srcDb.collection(parentCollection).get();
  let total = 0;
  for (const parent of parents.docs) {
    const subcols = await parent.ref.listCollections();
    for (const sub of subcols) {
      const subSnap = await sub.get();
      if (subSnap.empty) continue;
      const dstParentId = fullKeyMatch(parent.id) ?? parent.id;
      let batch = dstDb.batch();
      let inBatch = 0;
      for (const doc of subSnap.docs) {
        const data = remapUidsDeep(doc.data());
        const ref = dstDb.collection(parentCollection).doc(dstParentId).collection(sub.id).doc(doc.id);
        if (!DRY_RUN) {
          batch.set(ref, data, { merge: true });
          inBatch++;
          if (inBatch >= 400) { await batch.commit(); batch = dstDb.batch(); inBatch = 0; }
        }
        total++;
      }
      if (!DRY_RUN && inBatch > 0) await batch.commit();
      console.log(`  [${parentCollection}/${parent.id}/${sub.id}] ${DRY_RUN ? 'would-write' : 'written'}=${subSnap.size}`);
    }
  }
  return total;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Firestore migration: AI Studio -> mathdigitizer-pro');
  console.log('='.repeat(70));
  console.log(`Mode      : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE WRITE'}`);
  console.log(`Source    : ${OLD.projectId} / ${OLD.databaseId}`);
  console.log(`Target    : ${NEW.projectId} / ${NEW.databaseId}`);
  console.log(`UID remap : ${JSON.stringify(UID_REMAP)}`);
  console.log(`Filter    : ${ONLY ? ONLY.join(',') : 'ALL collections'}`);
  console.log('='.repeat(70));

  const srcDb = getDb(OLD.saPath, OLD.projectId, OLD.databaseId, 'old');
  const dstDb = getDb(NEW.saPath, NEW.projectId, NEW.databaseId, 'new');

  const collections = ONLY ?? COLLECTIONS;

  let totals = { read: 0, written: 0 };
  for (const c of collections) {
    try {
      const r = await copyCollection(srcDb, dstDb, c);
      totals.read += r.read;
      totals.written += r.written;
    } catch (e) {
      console.error(`  [${c}] ERROR: ${e.message}`);
    }
  }

  console.log('\n--- Subcollections ---');
  for (const parent of ['classrooms', 'assignments']) {
    if (ONLY && !ONLY.includes(parent)) continue;
    try { await copySubcollections(srcDb, dstDb, parent); }
    catch (e) { console.error(`  [${parent}/*] ERROR: ${e.message}`); }
  }

  console.log('='.repeat(70));
  console.log(`DONE. read=${totals.read} ${DRY_RUN ? 'would-write' : 'written'}=${totals.written}`);
  if (DRY_RUN) console.log('Re-run without --dry-run to actually write.');
  console.log('='.repeat(70));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * BRO Curriculum Ingestion Script
 * ================================
 * Fetches official math curriculum PDFs from bro.gov.mk,
 * extracts structured content via Gemini Vision,
 * generates embeddings, and stores in Firestore.
 *
 * Usage:
 *   node scripts/ingest-curriculum.mjs [--static] [--pdf] [--clear] [--grade=6]
 *
 * Options:
 *   --static      Ingest only static built-in curriculum (no PDF download, fast)
 *   --pdf         Download and process PDFs from bro.gov.mk (slow, rich content)
 *   --clear       Clear existing curriculum_knowledge collection first
 *   --grade=N     Process only a specific grade (e.g. --grade=8)
 *   --no-embed    Skip embedding generation (faster, keyword-only search)
 *
 * Requirements:
 *   GEMINI_API_KEY  — set in .env or environment
 *   Firebase Admin credentials — set GOOGLE_APPLICATION_CREDENTIALS or
 *                                 FIREBASE_SERVICE_ACCOUNT_JSON env var
 */

import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load env ────────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [k, ...vParts] = line.split('=');
    if (k && vParts.length) {
      process.env[k.trim()] = vParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set. Export it or add to .env');
  process.exit(1);
}

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const MODE_STATIC = args.includes('--static') || !args.includes('--pdf');
const MODE_PDF = args.includes('--pdf');
const DO_CLEAR = args.includes('--clear');
const NO_EMBED = args.includes('--no-embed');
const GRADE_FILTER = args.find(a => a.startsWith('--grade='))?.split('=')[1];

// ─── Firebase Admin ───────────────────────────────────────────────────────────

let db;
try {
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credPath = path.join(__dirname, '..', 'scripts', 'secrets', 'serviceAccount.json');

    if (serviceAccountJson) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
    } else if (existsSync(credPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(readFileSync(credPath, 'utf-8'))),
      });
    } else {
      console.error('❌ Firebase credentials not found.');
      console.error('   Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place serviceAccount.json in scripts/secrets/');
      process.exit(1);
    }
  }
  db = admin.firestore();
  console.log('✅ Firebase Admin connected');
} catch (e) {
  console.error('❌ Firebase Admin init failed:', e.message);
  process.exit(1);
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

async function geminiGenerateContent(contents, config = {}) {
  const payload = {
    contents: Array.isArray(contents) ? contents : [{ parts: [{ text: contents }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      ...config,
    },
  };

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ВАЖНО: мора да е ист модел со generateTaskEmbedding() во gemini.ts
// за да бидат споредливи векторите при cosine similarity пребарување
// GA model — gemini-embedding-2 (не preview). Мора да совпаѓа со generateTaskEmbedding() во gemini.ts
const EMBED_MODEL = 'gemini-embedding-2';

async function geminiEmbed(text) {
  if (NO_EMBED) return null;
  const payload = { model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } };
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.embedding?.values ?? null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ─── BRO PDF URLs ────────────────────────────────────────────────────────────

const BRO_PDF_URLS = {
  // Primary
  '1': 'https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-I_GO-mkd.pdf',
  '2': 'https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-II_GO-mkd.pdf',
  '3': 'https://www.bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-III_GO-mkd.pdf',
  '4-6-handbook': 'https://www.bro.gov.mk/wp-content/uploads/2019/07/Prirachnik_Matematika-IV-VI-odd.pdf',
  '7-9-handbook': 'https://www.bro.gov.mk/wp-content/uploads/2019/07/Prirachnik_po_Matematika_VII-IX.pdf',
  '7': 'https://bro.gov.mk/wp-content/uploads/2025/01/Nastavna-programa-Matematika-7-odd.-Prevod-na-Albanski-Final-2025-g..pdf',
};

async function downloadPdf(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': 'MathDigitizer/1.0 (curriculum ingestion)' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadPdf(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function extractCurriculumFromPdf(pdfBuffer, gradeHint) {
  const base64 = pdfBuffer.toString('base64');
  const prompt = `Ти си експерт за македонски наставни програми.
Анализирај го овој PDF документ (наставна програма по математика за ${gradeHint}).
Врати структуриран JSON со темите во програмата.

ВРАТИ ТОЧНО:
{
  "grade_label": "VII одделение",
  "topics": [
    {
      "name": "Рационални броеви",
      "hours": 25,
      "outcomes": ["Ученикот ги споредува рационалните броеви", "..."],
      "keywords": ["рационални", "дропки", "децимали"],
      "example_task_types": ["Пресметај...", "Реши..."]
    }
  ]
}`;

  const contents = [
    { parts: [{ text: prompt }] },
    { parts: [{ inlineData: { mimeType: 'application/pdf', data: base64 } }] },
  ];

  try {
    const raw = await geminiGenerateContent(contents);
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ?? [null, raw];
    return JSON.parse(match[1] ?? raw);
  } catch (e) {
    console.warn(`  ⚠ PDF extraction failed: ${e.message}`);
    return null;
  }
}

// ─── Static ingestion ─────────────────────────────────────────────────────────

async function ingestStatic() {
  // Dynamically import the static data
  // Since this is a .mjs script and curriculumData.ts is TypeScript,
  // we read the data directly from a JSON export or re-define it here
  const { ALL_MK_CURRICULUM, buildCurriculumChunkText } = await importCurriculumData();

  const gradeFilter = GRADE_FILTER;
  const allGrades = gradeFilter
    ? ALL_MK_CURRICULUM.filter(g => g.grade === gradeFilter)
    : ALL_MK_CURRICULUM;

  const total = allGrades.reduce((s, g) => s + g.topics.length, 0);
  console.log(`\n📚 Ingesting ${total} topic chunks from static data...`);
  if (gradeFilter) console.log(`   (filtered to grade: ${gradeFilter})`);

  let done = 0;
  let errors = 0;

  for (const grade of allGrades) {
    for (const topic of grade.topics) {
      const content = buildCurriculumChunkText(grade, topic);
      process.stdout.write(`  [${done + 1}/${total}] ${grade.level_label}: ${topic.name_short}... `);

      try {
        let embedding = null;
        if (!NO_EMBED) {
          embedding = await geminiEmbed(content);
          await new Promise(r => setTimeout(r, 200)); // rate limit
        }

        const chunk = {
          source: 'STATIC',
          education_track: grade.education_track,
          grade: grade.grade,
          level_label: grade.level_label,
          topic_id: topic.id,
          topic_name: topic.name,
          content,
          keywords: topic.keywords,
          example_tasks: topic.example_tasks,
          learning_outcomes: topic.outcomes.map(o => `[${o.code}] ${o.text}`),
          hours: topic.hours,
          embedding: embedding ?? [],
          created_at: new Date().toISOString(),
        };

        await db.collection('curriculum_knowledge').add(chunk);
        done++;
        console.log('✅');
      } catch (e) {
        errors++;
        console.log(`❌ ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Static ingestion complete: ${done} ingested, ${errors} errors`);
}

// ─── PDF ingestion ────────────────────────────────────────────────────────────

async function ingestPdfs() {
  console.log('\n📥 Downloading BRO curriculum PDFs...');
  let totalIngested = 0;

  for (const [gradeKey, url] of Object.entries(BRO_PDF_URLS)) {
    if (GRADE_FILTER && !gradeKey.includes(GRADE_FILTER)) continue;

    console.log(`\n  Downloading ${gradeKey}: ${url}`);
    let pdfBuffer;
    try {
      pdfBuffer = await downloadPdf(url);
      console.log(`  Downloaded ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.warn(`  ⚠ Download failed: ${e.message} — skipping`);
      continue;
    }

    const extracted = await extractCurriculumFromPdf(pdfBuffer, gradeKey);
    if (!extracted?.topics) {
      console.warn(`  ⚠ No topics extracted from ${gradeKey}`);
      continue;
    }

    console.log(`  Extracted ${extracted.topics.length} topics`);
    for (const topic of extracted.topics) {
      const content = [
        'НАСТАВНА ПРОГРАМА — МАТЕМАТИКА — БРО (PDF извор)',
        `Ниво: ${extracted.grade_label}`,
        `Тема: ${topic.name}`,
        `Часови: ${topic.hours ?? '—'}`,
        'Исходи:',
        ...(topic.outcomes ?? []).map(o => `  • ${o}`),
        `Клучни зборови: ${(topic.keywords ?? []).join(', ')}`,
        `Примери: ${(topic.example_task_types ?? []).join(' | ')}`,
      ].join('\n');

      let embedding = null;
      if (!NO_EMBED) {
        embedding = await geminiEmbed(content);
        await new Promise(r => setTimeout(r, 300));
      }

      await db.collection('curriculum_knowledge').add({
        source: 'BRO.GOV.MK',
        education_track: gradeKey.includes('год') ? 'secondary_general' : 'primary',
        grade: gradeKey,
        level_label: extracted.grade_label ?? gradeKey,
        topic_id: `bro-${gradeKey}-${topic.name.replace(/\s+/g, '-').toLowerCase()}`,
        topic_name: topic.name,
        content,
        keywords: topic.keywords ?? [],
        example_tasks: topic.example_task_types ?? [],
        learning_outcomes: topic.outcomes ?? [],
        hours: topic.hours ?? 0,
        embedding: embedding ?? [],
        pdf_source_url: url,
        created_at: new Date().toISOString(),
      });
      totalIngested++;
    }
  }

  console.log(`\n✅ PDF ingestion complete: ${totalIngested} chunks ingested`);
}

// ─── Import TS data as plain objects ─────────────────────────────────────────
// We re-export the static data as a plain .js module since we can't import TS directly

async function importCurriculumData() {
  // The static data is duplicated here for the script context.
  // In production, run `tsx scripts/ingest-curriculum.mjs` which supports TS imports.
  try {
    // Try tsx import (works if run with: node --loader tsx or tsx)
    const mod = await import('../src/lib/curriculumData.ts');
    return mod;
  } catch {
    // Fallback: return minimal stub so the script doesn't crash
    console.warn('⚠ Could not import curriculumData.ts — run with: npx tsx scripts/ingest-curriculum.mjs');
    return {
      ALL_MK_CURRICULUM: [],
      buildCurriculumChunkText: () => '',
    };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎓 MathDigitizer — BRO Curriculum Ingestion');
  console.log('============================================');
  console.log(`Mode: ${MODE_PDF ? 'PDF + Static' : 'Static only'}`);
  console.log(`Embeddings: ${NO_EMBED ? 'disabled' : `enabled (${EMBED_MODEL})`}`);
  if (GRADE_FILTER) console.log(`Grade filter: ${GRADE_FILTER}`);

  if (DO_CLEAR) {
    console.log('\n🗑  Clearing curriculum_knowledge collection...');
    const snap = await db.collection('curriculum_knowledge').get();
    const batches = [];
    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 400 === 0) {
        batches.push(batch.commit());
        batch = db.batch();
      }
    }
    batches.push(batch.commit());
    await Promise.all(batches);
    console.log(`  Deleted ${snap.size} documents`);
  }

  if (MODE_STATIC) await ingestStatic();
  if (MODE_PDF) await ingestPdfs();

  const finalSnap = await db.collection('curriculum_knowledge').get();
  console.log(`\n📊 Final collection size: ${finalSnap.size} chunks`);
  console.log('\n🚀 Done! The app will now use the official MK curriculum for task alignment.');
  console.log('   Run the app and generate a task — curriculum context will be injected automatically.');
}

main().catch(e => {
  console.error('\n💥 Fatal error:', e);
  process.exit(1);
});

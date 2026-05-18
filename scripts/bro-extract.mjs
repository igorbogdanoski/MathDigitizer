#!/usr/bin/env node
/**
 * BRO Curriculum Extractor — Primary + Secondary
 * ================================================
 * Downloads official math PDFs from bro.gov.mk,
 * extracts structured content via Gemini 2.5 Flash Vision,
 * and outputs JSON + patches curriculumData.ts.
 *
 * Usage:
 *   node scripts/bro-extract.mjs                    # all primary (1-9)
 *   node scripts/bro-extract.mjs --secondary         # all secondary
 *   node scripts/bro-extract.mjs --all               # primary + secondary
 *   node scripts/bro-extract.mjs --grade=7           # single primary grade
 *   node scripts/bro-extract.mjs --track=gymnasium   # one secondary track
 *   node scripts/bro-extract.mjs --patch             # rebuild curriculumData.ts
 *
 * Tier 1 API safety: 5s between Gemini calls (max 12 RPM, limit is 15 RPM)
 *
 * Requirements: VITE_GEMINI_API_KEY or GEMINI_API_KEY in .env.local / .env
 */

// Disable SSL verification — bro.gov.mk uses intermediate CA not in Node's bundle
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { readFileSync, writeFileSync, existsSync } from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load env ────────────────────────────────────────────────────────────────
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', envFile);
  if (existsSync(p)) {
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
    console.log(`✅ Loaded env from ${envFile}`);
    break;
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY not found'); process.exit(1); }

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const GRADE_FILTER  = args.find(a => a.startsWith('--grade='))?.split('=')[1];
const TRACK_FILTER  = args.find(a => a.startsWith('--track='))?.split('=')[1];
const DO_SECONDARY  = args.includes('--secondary') || args.includes('--all');
const DO_PRIMARY    = !args.includes('--secondary') || args.includes('--all');
const DO_PATCH      = args.includes('--patch');
const OUT_FILE      = path.join(__dirname, 'bro-curriculum-output.json');

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Tier 1: 15 RPM → 1 call per 4s. We use 5s to stay well within limits.
const RATE_DELAY_MS = 5000;

// ─── PRIMARY PDFs (деветгодишно основно I-IX) ────────────────────────────────
const BRO_PRIMARY_PDFS = [
  { grade: '1', level_label: 'I одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2021/04/%D0%9D%D0%9F-M%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0-I-%D0%BE%D0%B4%D0%B4.pdf'] },
  { grade: '2', level_label: 'II одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2022/08/%D0%9D%D0%9F-M%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0-II-%D0%BE%D0%B4%D0%B4.pdf'] },
  { grade: '3', level_label: 'III одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2022/12/M%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0-III-%D0%BE%D0%B4%D0%B4%D0%B5%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D0%A45541.pdf'] },
  { grade: '4', level_label: 'IV одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2021/05/%D0%9B%D0%95%D0%9A%D0%A2%D0%A3%D0%A0%D0%90-%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0-4.pdf'] },
  { grade: '5', level_label: 'V одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2022/01/%D0%9D%D0%9F%D0%A0-%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0-V-%D0%BE%D0%B4%D0%B4.pdf'] },
  { grade: '6', level_label: 'VI одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2023/03/Matematika-6-odd.6603.pdf'] },
  { grade: '7', level_label: 'VII одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2025/01/Nastavna-programa-Matematika-7-odd.pdf'] },
  { grade: '8', level_label: 'VIII одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-VIII_odd-mkd.pdf'] },
  { grade: '9', level_label: 'IX одделение', education_track: 'primary',
    urls: ['https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-IX_odd-mkd.pdf'] },
];

// ─── SECONDARY PDFs ───────────────────────────────────────────────────────────
// Note: MIG sends multiple PDFs per year as multi-part (Algebra + Geometry + etc.)
// This reduces API calls and gives Gemini full context for the year.
const BRO_SECONDARY_PDFS = [
  // ── Гимназиско образование (secondary_general) ────────────────────────────
  {
    grade: '1год', level_label: 'I година гимназија', education_track: 'secondary_general',
    urls: ['https://bro.gov.mk/wp-content/uploads/2025/07/NP_Matematika_I_gimnazisko_finalna.pdf'],
  },
  {
    grade: '2год', level_label: 'II година гимназија', education_track: 'secondary_general',
    urls: ['https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-II_GO-mkd.pdf'],
  },
  {
    grade: '3год', level_label: 'III година гимназија', education_track: 'secondary_general',
    urls: ['https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-III_GO-mkd.pdf'],
  },
  {
    grade: '4год', level_label: 'IV година гимназија', education_track: 'secondary_general',
    urls: ['https://bro.gov.mk/wp-content/uploads/2018/02/Nastavna_programa-Matematika-IV_GO-mkd.pdf'],
  },

  // ── МИГ (secondary_math_info) ─────────────────────────────────────────────
  // Multiple PDFs per year — Gemini processes all parts together
  {
    grade: '1год-миг', level_label: 'I година МИГ', education_track: 'secondary_math_info',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2020/06/Nastavna_programa-Algebra-I-MIG.pdf',
      'https://bro.gov.mk/wp-content/uploads/2020/06/Nastavna_programa-Geometrija-I-MIG.pdf',
      'https://bro.gov.mk/wp-content/uploads/2020/06/Nastavna_programa-Funkcii_i_realni_broevi-I-MIG.pdf',
    ],
    subjects: ['Алгебра', 'Геометрија', 'Функции и реални броеви'],
  },
  {
    grade: '2год-миг', level_label: 'II година МИГ', education_track: 'secondary_math_info',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2021/09/NP_II_MIG_ALGEBRA.pdf',
      'https://bro.gov.mk/wp-content/uploads/2021/09/NP_II_MIG_GEOMETRIJA.pdf',
      'https://bro.gov.mk/wp-content/uploads/2021/09/NP_II_MIG_-FUNKCII-I-REALNI-BROEVI.pdf',
    ],
    subjects: ['Алгебра', 'Геометрија', 'Функции и реални броеви'],
  },
  {
    grade: '3год-миг', level_label: 'III година МИГ', education_track: 'secondary_math_info',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2022/07/Algebra-MIG_III_god.pdf',
      'https://bro.gov.mk/wp-content/uploads/2022/07/Geometrija-MIG_III_god_3_chasa.pdf',
      'https://bro.gov.mk/wp-content/uploads/2022/07/Matematichka_analiza-MIG_III_god.pdf',
    ],
    subjects: ['Алгебра', 'Геометрија', 'Математичка анализа'],
  },
  {
    grade: '4год-миг', level_label: 'IV година МИГ', education_track: 'secondary_math_info',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2023/07/NP-Algebra-MIG_4_god.pdf',
      'https://bro.gov.mk/wp-content/uploads/2023/07/NP-Geometrija-MIG_4_god.pdf',
      'https://bro.gov.mk/wp-content/uploads/2023/07/NP-Mat-ANALIZA-MIG_4_god.pdf',
    ],
    subjects: ['Алгебра', 'Геометрија', 'Математичка анализа'],
  },

  // ── Стручно 4-годишно (secondary_vocational) ──────────────────────────────
  // Use 3-hour variant (richer content) as primary; 2-hour as fallback
  {
    grade: '1год-струк', level_label: 'I година стручно', education_track: 'secondary_vocational',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2019/07/Nastavna_programa-MATEMATIKA-I_god-4-3_chasa.pdf',
      'https://bro.gov.mk/wp-content/uploads/2019/07/Nastavna_programa-MATEMATIKA-I_god-4-2_chasa.pdf',
    ],
  },
  {
    grade: '2год-струк', level_label: 'II година стручно', education_track: 'secondary_vocational',
    urls: [
      'https://bro.gov.mk/wp-content/uploads/2019/10/Nastavna_programa-Matematika-II-SSO4-eksperimentalna-3_chasa.pdf',
      'https://bro.gov.mk/wp-content/uploads/2020/06/Nastavna_programa-Matematika-II-SSO4-2_chasa-eksperimentalna.pdf',
    ],
  },
  {
    grade: '3год-струк', level_label: 'III година стручно', education_track: 'secondary_vocational',
    urls: ['https://bro.gov.mk/wp-content/uploads/2020/06/Nastavna_programa-Matematika-III-SSO4-eksperimentalna.pdf'],
  },
  {
    grade: '4год-струк', level_label: 'IV година стручно', education_track: 'secondary_vocational',
    urls: ['https://bro.gov.mk/wp-content/uploads/2022/03/NP-MATEMATIKA-IV-god.pdf'],
  },
];

// ─── Atomic-safe save (re-reads file before writing to avoid race conditions) ─
function safeSave(outFile, newEntry) {
  let current = [];
  try { current = JSON.parse(readFileSync(outFile, 'utf-8')); } catch {}
  // Replace or append
  const idx = current.findIndex(e => e.grade === newEntry.grade);
  if (idx >= 0) current[idx] = newEntry;
  else current.push(newEntry);
  writeFileSync(outFile, JSON.stringify(current, null, 2), 'utf-8');
}

// ─── HTTP download ────────────────────────────────────────────────────────────
async function downloadPdf(url, redirectCount = 0) {
  if (redirectCount > 5) throw new Error('Too many redirects');
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, { headers: { 'User-Agent': 'MathDigitizer/1.0' }, rejectUnauthorized: false }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        res.resume();
        const next = loc.startsWith('http') ? loc : new URL(loc, url).toString();
        return downloadPdf(next, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Gemini Vision extraction ─────────────────────────────────────────────────
async function extractFromPdfs(pdfBuffers, entry) {
  const isMulti = pdfBuffers.length > 1;
  const subjectList = entry.subjects ? entry.subjects.join(', ') : 'Математика';
  const trackLabel = {
    primary: 'деветгодишно основно образование',
    secondary_general: 'гимназиско образование (општа гимназија)',
    secondary_math_info: 'математичко-информатичка гимназија (МИГ)',
    secondary_vocational: 'четиригодишно средно стручно образование',
  }[entry.education_track] ?? entry.education_track;

  const gradeSlug = entry.grade.replace(/[^a-z0-9]/gi, '-');

  const prompt = `Ти си експерт за официјалните наставни програми на БРО (Биро за развој на образованието) на Република Македонија.

Анализирај ${isMulti ? 'овие наставни програми' : 'оваа наставна програма'} по ${subjectList} за ${entry.level_label} (${trackLabel}).
${isMulti ? `Документите се: ${subjectList} (${pdfBuffers.length} одделни PDF-а).` : ''}

Врати САМО валиден JSON (без markdown, без \`\`\`):

{
  "grade": "${entry.grade}",
  "level_label": "${entry.level_label}",
  "education_track": "${entry.education_track}",
  "hours_per_week": <број — за стручно обично 2-3, за гимназија 4, за МИГ 5-6>,
  "topics": [
    {
      "id": "mk-${gradeSlug}-<slug>",
      "name": "<целосно македонско име на темата/предметот>",
      "name_short": "<2-3 збора>",
      "hours": <број часови>,
      "outcomes": [
        { "code": "<МА/ГЕ/АН>.${entry.grade}.N.N", "text": "<исход>" }
      ],
      "keywords": ["<минимум 5 клучни зборови>"],
      "example_tasks": ["<минимум 2 примери на задачи>"]
    }
  ]
}

ПРАВИЛА:
- Извади ги СИТЕ теми/предмети (за МИГ: засебна тема за секој предмет — Алгебра, Геометрија, итн.)
- За МИГ: outcome code prefix = АЛ (алгебра), ГЕ (геометрија), АН (анализа)
- keywords и example_tasks мора да се на македонски
- Не додавај полиња надвор од шемата`;

  // Build parts: text prompt + one inlineData per PDF
  const parts = [{ text: prompt }];
  for (const buf of pdfBuffers) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json' },
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
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          resolve(JSON.parse(clean));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message} | Raw: ${data.slice(0, 400)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Process one entry ────────────────────────────────────────────────────────
// For multi-subject entries (MIG): each PDF is called separately, topics merged.
// This avoids 7MB+ request bodies that exceed Gemini API limits.
async function processEntry(entry, results, label) {
  console.log(`\n📥 ${label} (${entry.level_label})`);

  const isMultiSubject = entry.urls.length > 1 && entry.subjects;

  if (isMultiSubject) {
    // Process each subject PDF separately → merge topics
    const allTopics = [];

    for (let i = 0; i < entry.urls.length; i++) {
      const url = entry.urls[i];
      const subj = entry.subjects[i];
      process.stdout.write(`   ↳ ${subj}: downloading... `);

      let buf;
      try {
        buf = await downloadPdf(url);
        console.log(`✅ ${(buf.length / 1024).toFixed(0)} KB`);
      } catch (e) {
        console.log(`⚠ ${e.message} — skipped`);
        continue;
      }

      // Synthesize a per-subject entry for the extractor
      const subEntry = {
        ...entry,
        grade: entry.grade,
        level_label: `${entry.level_label} — ${subj}`,
        subjects: undefined,
        urls: [url],
      };

      process.stdout.write(`     Extracting ${subj}... `);
      try {
        const extracted = await extractFromPdfs([buf], subEntry);
        if (extracted?.topics?.length) {
          console.log(`✅ ${extracted.topics.length} topics`);
          allTopics.push(...extracted.topics);
        } else {
          console.log(`⚠ No topics`);
        }
      } catch (e) {
        console.log(`❌ ${e.message}`);
      }

      // Rate limit between each subject PDF call
      if (i < entry.urls.length - 1) {
        process.stdout.write(`     ⏱ ${RATE_DELAY_MS / 1000}s...\n`);
        await new Promise(r => setTimeout(r, RATE_DELAY_MS));
      }
    }

    if (!allTopics.length) {
      console.log(`   ❌ No topics extracted — skipping`);
      return;
    }

    const merged = {
      grade: entry.grade,
      level_label: entry.level_label,
      education_track: entry.education_track,
      hours_per_week: entry.hours_per_week || 6,
      topics: allTopics,
      pdf_source_urls: entry.urls,
    };
    safeSave(OUT_FILE, merged);
    results.push(merged);
    console.log(`   ✅ Merged: ${allTopics.length} topics total`);

  } else {
    // Single-PDF entry: try urls in order
    let pdfBuffer = null;
    for (const url of entry.urls) {
      process.stdout.write(`   Downloading ${url.slice(0, 65)}... `);
      try {
        pdfBuffer = await downloadPdf(url);
        console.log(`✅ ${(pdfBuffer.length / 1024).toFixed(0)} KB`);
        break;
      } catch (e) {
        console.log(`⚠ ${e.message}`);
      }
    }
    if (!pdfBuffer) { console.log(`   ❌ Download failed`); return; }

    process.stdout.write(`   Extracting with Gemini 2.5 Flash... `);
    try {
      const extracted = await extractFromPdfs([pdfBuffer], entry);
      if (!extracted?.topics?.length) throw new Error('No topics returned');
      console.log(`✅ ${extracted.topics.length} topics`);
      extracted.pdf_source_urls = entry.urls;
      results.push(extracted);
      safeSave(OUT_FILE, extracted);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎓 BRO Curriculum Extractor — Primary + Secondary');
  console.log('===================================================');
  console.log(`Rate limit: ${RATE_DELAY_MS / 1000}s between Gemini calls (Tier 1 safe)`);

  // Build target list
  let targets = [];
  if (DO_PRIMARY) {
    const primary = GRADE_FILTER
      ? BRO_PRIMARY_PDFS.filter(e => e.grade === GRADE_FILTER)
      : BRO_PRIMARY_PDFS;
    targets.push(...primary);
  }
  if (DO_SECONDARY) {
    const trackMap = {
      gymnasium: 'secondary_general',
      mig: 'secondary_math_info',
      vocational: 'secondary_vocational',
    };
    const mapped = TRACK_FILTER ? trackMap[TRACK_FILTER] : null;
    const secondary = mapped
      ? BRO_SECONDARY_PDFS.filter(e => e.education_track === mapped)
      : BRO_SECONDARY_PDFS;
    targets.push(...secondary);
  }

  if (!targets.length) {
    console.error('❌ No targets matched. Check --grade / --track flags.');
    process.exit(1);
  }

  // Load existing
  let existing = [];
  if (existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(readFileSync(OUT_FILE, 'utf-8'));
      console.log(`📂 Existing output: ${existing.length} entries`);
    } catch { existing = []; }
  }

  const results = [...existing];
  const toProcess = targets.filter(t => !existing.find(e => e.grade === t.grade));

  if (!toProcess.length) {
    console.log('✅ All targets already extracted.');
    if (DO_PATCH) await patchCurriculumData(results);
    return;
  }

  console.log(`\n📋 To process: ${toProcess.length} entries (${toProcess.map(t => t.grade).join(', ')})`);

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    await processEntry(entry, results, `[${i + 1}/${toProcess.length}] ${entry.grade}`);

    // Rate limit: wait between Gemini calls
    if (i < toProcess.length - 1) {
      process.stdout.write(`   ⏱ Waiting ${RATE_DELAY_MS / 1000}s (Tier 1 rate limit)...\n`);
      await new Promise(r => setTimeout(r, RATE_DELAY_MS));
    }
  }

  const total = results.length;
  const byTrack = {};
  results.forEach(r => { byTrack[r.education_track] = (byTrack[r.education_track] || 0) + 1; });

  console.log(`\n📊 Total: ${total} entries`);
  Object.entries(byTrack).forEach(([t, c]) => console.log(`   ${t}: ${c}`));
  console.log(`💾 Output: ${OUT_FILE}`);

  if (DO_PATCH) await patchCurriculumData(results);
  else {
    console.log(`\n💡 Run with --patch to update src/lib/curriculumData.ts`);
  }
}

// ─── Patch curriculumData.ts ──────────────────────────────────────────────────
async function patchCurriculumData(results) {
  const tsPath = path.join(__dirname, '..', 'src', 'lib', 'curriculumData.ts');
  if (!existsSync(tsPath)) { console.error('❌ curriculumData.ts not found'); return; }

  console.log('\n🔧 Patching src/lib/curriculumData.ts...');
  const ts = readFileSync(tsPath, 'utf-8');

  const esc = s => String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ');

  const buildGrades = (track) => results
    .filter(g => g.education_track === track)
    .sort((a, b) => a.grade.localeCompare(b.grade))
    .map(g => {
      const topicsStr = (g.topics || []).map(t => {
        const outcomes = (t.outcomes || [])
          .map(o => `        { code: '${esc(o.code)}', text: '${esc(o.text)}' }`)
          .join(',\n');
        const kw = (t.keywords || []).map(k => `'${esc(k)}'`).join(', ');
        const et = (t.example_tasks || []).map(e => `'${esc(e)}'`).join(', ');
        return `    {
      id: '${esc(t.id)}',
      name: '${esc(t.name)}',
      name_short: '${esc(t.name_short)}',
      hours: ${t.hours || 0},
      outcomes: [
${outcomes},
      ],
      keywords: [${kw}],
      example_tasks: [${et}],
    }`;
      }).join(',\n');
      return `  {\n    grade: '${g.grade}', level_label: '${esc(g.level_label)}', education_track: '${g.education_track}', hours_per_week: ${g.hours_per_week || 4},\n    topics: [\n${topicsStr},\n    ],\n  }`;
    }).join(',\n');

  // Uses `];` at column 0 as end boundary — safe because string content
  // never starts a line with `];` in this file.
  const replaceBlock = (ts, constName, newContent) => {
    const lines = ts.split('\n');
    const startPattern = `const ${constName}:`;
    let startLine = -1, endLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (startLine === -1 && lines[i].startsWith(startPattern)) {
        startLine = i;
      } else if (startLine !== -1 && lines[i] === '];') {
        endLine = i;
        break;
      }
    }
    if (startLine === -1 || endLine === -1) return ts;
    return [...lines.slice(0, startLine), newContent, ...lines.slice(endLine + 1)].join('\n');
  };

  let patched = ts;

  // Patch PRIMARY_GRADES
  const primaryBlock = buildGrades('primary');
  if (primaryBlock) {
    patched = replaceBlock(patched, 'PRIMARY_GRADES', `const PRIMARY_GRADES: CurriculumGrade[] = [\n${primaryBlock},\n];`);
  }

  // Patch SECONDARY_GENERAL_GRADES
  const gymBlock = buildGrades('secondary_general');
  if (gymBlock) {
    patched = replaceBlock(patched, 'SECONDARY_GENERAL_GRADES', `const SECONDARY_GENERAL_GRADES: CurriculumGrade[] = [\n${gymBlock},\n];`);
  }

  // Patch SECONDARY_MATH_INFO_GRADES
  const migBlock = buildGrades('secondary_math_info');
  if (migBlock) {
    patched = replaceBlock(patched, 'SECONDARY_MATH_INFO_GRADES', `const SECONDARY_MATH_INFO_GRADES: CurriculumGrade[] = [\n${migBlock},\n];`);
  }

  // Patch SECONDARY_VOCATIONAL_GRADES if it exists, else add it
  const vocBlock = buildGrades('secondary_vocational');
  if (vocBlock) {
    if (patched.includes('const SECONDARY_VOCATIONAL_GRADES:')) {
      patched = replaceBlock(patched, 'SECONDARY_VOCATIONAL_GRADES', `const SECONDARY_VOCATIONAL_GRADES: CurriculumGrade[] = [\n${vocBlock},\n];`);
    } else {
      // Insert before the combined export section
      const insertBefore = patched.indexOf('// ─── Combined export');
      if (insertBefore >= 0) {
        const vocSection = `// ─── SECONDARY VOCATIONAL — Средно стручно образование ──────────────────────\n\nconst SECONDARY_VOCATIONAL_GRADES: CurriculumGrade[] = [\n${vocBlock},\n];\n\n`;
        patched = patched.slice(0, insertBefore) + vocSection + patched.slice(insertBefore);
      }
      // Also add to ALL_MK_CURRICULUM spread
      patched = patched.replace(
        '...SECONDARY_MATH_INFO_GRADES,',
        '...SECONDARY_MATH_INFO_GRADES,\n  ...SECONDARY_VOCATIONAL_GRADES,'
      );
    }
  }

  writeFileSync(tsPath + '.bak', ts, 'utf-8');
  writeFileSync(tsPath, patched, 'utf-8');

  const topicCount = results.reduce((s, g) => s + (g.topics?.length || 0), 0);
  console.log(`✅ Patched! ${results.length} grades, ${topicCount} topics total`);
  console.log(`   Backup: curriculumData.ts.bak`);
}

main().catch(e => { console.error('\n💥 Fatal:', e.message); process.exit(1); });

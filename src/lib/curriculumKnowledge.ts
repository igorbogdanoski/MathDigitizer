// Curriculum Knowledge — Firestore-backed persistent curriculum RAG
// Collection: curriculum_knowledge
// Populated by: scripts/ingest-curriculum.mjs + CurriculumAdmin.tsx UI
//
// Retrieval runs in three tiers, each falling through to the next: embedding
// search over ingested chunks, keyword search over those same chunks, and —
// when Firestore holds nothing — keyword search over the static corpus. The
// generators reach all three through `buildCurriculumContextBlockRag`.
//
// Whatever comes back is put in front of the model as the outcomes the task
// MUST comply with, so retrieving from the wrong programme is not a quality
// issue — it is the app asserting something untrue about a state curriculum.
// That is why the grade filter is applied in every tier and why a hint that
// names no single programme filters nothing rather than picking one.

import { collection, query, where, getDocs, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { cosineSimilarity } from './ragContext';
import type {
  CurriculumGrade,
  CurriculumTopic,
  EducationTrack,
} from './curriculumData';
import { CURRICULUM_INDEX } from './curriculumIndex';
import { resolveGradeToken } from './curriculumGrade';

/**
 * The corpus is loaded on demand.
 *
 * Only two functions here need the wording of the outcomes, and both are async.
 * A static import put all 571 KB into every bundle that can reach this module —
 * which, through the AI client, is nearly all of them.
 */
async function loadCorpus() {
  const { ALL_MK_CURRICULUM, searchCurriculumKeyword, buildCurriculumChunkText } =
    await import('./curriculumData');
  return { ALL_MK_CURRICULUM, searchCurriculumKeyword, buildCurriculumChunkText };
}

export interface CurriculumChunk {
  id?: string;
  source: 'BRO.GOV.MK' | 'STATIC';
  education_track: EducationTrack;
  grade: string;
  level_label: string;
  topic_id: string;
  topic_name: string;
  content: string;                // Full rich text for this topic
  keywords: string[];
  example_tasks: string[];
  learning_outcomes: string[];
  hours: number;
  embedding?: number[];
  created_at: string;
  pdf_source_url?: string;        // Set when ingested from actual BRO PDF
}

export interface CurriculumSearchResult {
  chunk: CurriculumChunk;
  score: number;
  retrieval_mode: 'embedding' | 'keyword';
}

const COLLECTION = 'curriculum_knowledge';

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getCurriculumChunks(
  track?: EducationTrack,
  grade?: string,
): Promise<CurriculumChunk[]> {
  try {
    // Each filter is applied on its own merit. The previous shape only honoured
    // `grade` when `track` was also given, and the RAG path never passes a
    // track — so every retrieval searched all 31 programmes while looking as
    // though it were scoped to one.
    const constraints = [
      ...(track ? [where('education_track', '==', track)] : []),
      ...(grade ? [where('grade', '==', grade)] : []),
    ];
    const q = query(collection(db, COLLECTION), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CurriculumChunk));
  } catch {
    return [];
  }
}

export async function getCurriculumChunkCount(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.size;
  } catch {
    return 0;
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchCurriculum(
  query: string,
  options: {
    embedQuery?: (text: string) => Promise<number[]>;
    gradeFilter?: string;
    trackFilter?: EducationTrack;
    maxResults?: number;
  } = {},
): Promise<CurriculumSearchResult[]> {
  const maxResults = options.maxResults ?? 3;

  // A hint that names no single programme resolves to null and filters nothing,
  // which leaves retrieval as wide as it was. Guessing a programme would be
  // worse: the prompt presents whatever comes back as the outcomes the task
  // must comply with.
  const gradeToken = resolveGradeToken(options.gradeFilter);

  // 1. Try Firestore embedding search
  const chunks = await getCurriculumChunks(options.trackFilter, gradeToken ?? undefined);

  if (chunks.length > 0 && options.embedQuery) {
    try {
      const qEmb = await options.embedQuery(query);
      const withEmbedding = chunks.filter(c => Array.isArray(c.embedding) && c.embedding!.length > 0);
      if (withEmbedding.length > 0) {
        const ranked = withEmbedding
          .map(c => ({ chunk: c, score: cosineSimilarity(qEmb, c.embedding!) }))
          .filter(r => r.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, maxResults);
        if (ranked.length > 0) {
          return ranked.map(r => ({ ...r, retrieval_mode: 'embedding' as const }));
        }
      }
    } catch {
      // fall through to keyword
    }
  }

  // 2. Keyword search in Firestore chunks
  if (chunks.length > 0) {
    const tokens = query.toLowerCase().split(/\s+/);
    const ranked = chunks
      .map(c => {
        const haystack = [c.topic_name, c.content, ...c.keywords, ...c.learning_outcomes].join(' ').toLowerCase();
        const score = tokens.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0) / tokens.length;
        return { chunk: c, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    if (ranked.length > 0) {
      return ranked.map(r => ({ ...r, retrieval_mode: 'keyword' as const }));
    }
  }

  // 3. Fallback: static keyword search (no Firestore)
  const { ALL_MK_CURRICULUM, searchCurriculumKeyword, buildCurriculumChunkText } = await loadCorpus();
  const staticTopics = searchCurriculumKeyword(query, gradeToken ?? undefined);
  return staticTopics.slice(0, maxResults).map(topic => {
    const grade = ALL_MK_CURRICULUM.find(g => g.topics.some(t => t.id === topic.id))!;
    const chunk = buildStaticChunk(grade, topic, buildCurriculumChunkText);
    return { chunk, score: 0.5, retrieval_mode: 'keyword' as const };
  });
}

// Build a prompt-ready context string from search results
export function formatCurriculumContext(results: CurriculumSearchResult[]): string {
  if (results.length === 0) return '';
  const lines = [
    '═══ ОФИЦИЈАЛНА НАСТАВНА ПРОГРАМА — МАТЕМАТИКА — БРО.ГОВ.МК ═══',
    'Следниот контекст е извлечен од официјалните наставни програми.',
    'Генерираните задачи МОРА да бидат усогласени со овие исходи и теми.',
    '',
  ];
  results.forEach((r, i) => {
    lines.push(`--- Тема ${i + 1}: ${r.chunk.topic_name} (${r.chunk.level_label}) ---`);
    lines.push(r.chunk.content);
    lines.push('');
  });
  lines.push('═══════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

// ─── Ingest: populate from static data (fallback, no PDF needed) ──────────────

function buildStaticChunk(
  grade: CurriculumGrade,
  topic: CurriculumTopic,
  buildChunkText: (g: CurriculumGrade, t: CurriculumTopic) => string,
): CurriculumChunk {
  return {
    source: 'STATIC',
    education_track: grade.education_track,
    grade: grade.grade,
    level_label: grade.level_label,
    topic_id: topic.id,
    topic_name: topic.name,
    content: buildChunkText(grade, topic),
    keywords: topic.keywords,
    example_tasks: topic.example_tasks,
    learning_outcomes: topic.outcomes.map(o => `[${o.code}] ${o.text}`),
    hours: topic.hours,
    created_at: new Date().toISOString(),
  };
}

export async function ingestStaticCurriculum(
  onProgress?: (done: number, total: number) => void,
  embedFn?: (text: string) => Promise<number[]>,
): Promise<{ ingested: number; errors: number }> {
  // Build all chunks
  const { ALL_MK_CURRICULUM, buildCurriculumChunkText } = await loadCorpus();
  const allChunks: CurriculumChunk[] = [];
  for (const grade of ALL_MK_CURRICULUM) {
    for (const topic of grade.topics) {
      allChunks.push(buildStaticChunk(grade, topic, buildCurriculumChunkText));
    }
  }

  // Clear existing static chunks
  try {
    const existing = await getDocs(
      query(collection(db, COLLECTION), where('source', '==', 'STATIC'))
    );
    const batch = writeBatch(db);
    existing.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch { /* ignore */ }

  let ingested = 0;
  let errors = 0;

  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    onProgress?.(i, allChunks.length);
    try {
      // Generate embedding if function provided
      if (embedFn) {
        try {
          chunk.embedding = await embedFn(chunk.content);
        } catch { /* store without embedding, search falls back to keyword */ }
      }
      await addDoc(collection(db, COLLECTION), chunk);
      ingested++;
    } catch {
      errors++;
    }
  }

  onProgress?.(allChunks.length, allChunks.length);
  return { ingested, errors };
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function clearAllCurriculumChunks(): Promise<void> {
  const snap = await getDocs(collection(db, COLLECTION));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export function getTotalStaticChunkCount(): number {
  // A count needs no prose — the index carries it.
  return CURRICULUM_INDEX.reduce((sum, g) => sum + g.topics.length, 0);
}

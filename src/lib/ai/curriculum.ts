/**
 * Curriculum classification domain — aligns extracted/library tasks with the
 * official Macedonian (БРО) curriculum topics and learning outcomes.
 *
 * Pipeline (classifyTaskCurriculum):
 * 1. Build a query from task.title + task.original_text + task.tags
 * 2. RAG-retrieve the top-5 candidate topics (searchCurriculum: Firestore
 *    curriculum_knowledge chunks → static ALL_MK_CURRICULUM keyword fallback)
 * 3. Constrained Gemini call: the model may ONLY pick among the candidates
 * 4. Validate topic_id + outcome_codes against the actual curriculum data
 *    (anti-hallucination) and return CurriculumRef[]
 */
import { Type } from '@google/genai';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MathTask, CurriculumRef } from '../schema';
import { searchCurriculum } from '../curriculumKnowledge';
import type { CurriculumChunk } from '../curriculumKnowledge';
// Classification needs identity — track, grade, topic name, outcome codes —
// not the wording of the outcomes. The light index carries exactly that, and
// keeps the 571 KB corpus out of every bundle that can classify a task.
import { CURRICULUM_INDEX } from '../curriculumIndex';
import { ai } from './client';
import { parseGeminiResponse } from './utils';
import { generateTaskEmbedding } from './embeddings';
import { DEFAULT_MODEL } from './models';

/** Minimum model confidence for a classification to be accepted. */
const MIN_CONFIDENCE = 0.5;

// ─── Static topic index (canonical БРО data) ────────────────────────────────

interface StaticTopicInfo {
  education_track: string;
  grade: string;
  topic_name: string;
  outcome_codes: Set<string>;
}

let _staticIndex: Map<string, StaticTopicInfo> | null = null;

function getStaticTopicIndex(): Map<string, StaticTopicInfo> {
  if (!_staticIndex) {
    _staticIndex = new Map();
    for (const grade of CURRICULUM_INDEX) {
      for (const topic of grade.topics) {
        if (_staticIndex.has(topic.id)) continue;
        _staticIndex.set(topic.id, {
          education_track: grade.education_track,
          grade: grade.grade,
          topic_name: topic.name,
          outcome_codes: new Set(topic.outcome_codes),
        });
      }
    }
  }
  return _staticIndex;
}

/** All valid outcome codes for a topic: canonical static data plus codes parsed from the chunk. */
function collectOutcomeCodes(chunk: CurriculumChunk): Set<string> {
  const codes = new Set<string>();
  const staticInfo = getStaticTopicIndex().get(chunk.topic_id);
  if (staticInfo) {
    staticInfo.outcome_codes.forEach(c => codes.add(c));
  }
  for (const outcome of chunk.learning_outcomes || []) {
    const match = outcome.match(/\[([^\]]+)\]/);
    if (match) codes.add(match[1].trim());
  }
  return codes;
}

// ─── Classification ─────────────────────────────────────────────────────────

/**
 * Classify a single task against the official MK curriculum.
 *
 * Never throws — returns [] when there is no confident, verified match or on
 * any error, so callers can run it non-blocking alongside saves.
 */
export async function classifyTaskCurriculum(task: MathTask): Promise<CurriculumRef[]> {
  try {
    // 1. Build the retrieval query from the task content
    const query = [
      task.title,
      task.original_text?.slice(0, 400),
      (task.tags || []).join(' '),
      task.curriculum_topic || '',
    ].filter(Boolean).join(' ').trim();
    if (!query) return [];

    // 2. Top-5 candidate topics via RAG (embedding → keyword → static fallback)
    const candidates = await searchCurriculum(query, {
      embedQuery: generateTaskEmbedding,
      maxResults: 5,
    });
    if (candidates.length === 0) return [];

    // Dedupe by topic_id (one topic can have multiple chunks); keep best score
    const byTopic = new Map<string, { chunk: CurriculumChunk; codes: Set<string> }>();
    for (const result of candidates) {
      const { chunk } = result;
      if (!chunk.topic_id || byTopic.has(chunk.topic_id)) continue;
      byTopic.set(chunk.topic_id, { chunk, codes: collectOutcomeCodes(chunk) });
    }
    if (byTopic.size === 0) return [];

    // 3. Constrained Gemini call — the model may only choose among candidates
    const candidatesBlock = Array.from(byTopic.values())
      .map(({ chunk }, i) => {
        const lines = [
          `--- Кандидат ${i + 1} ---`,
          `topic_id: ${chunk.topic_id}`,
          `Тема: ${chunk.topic_name} (${chunk.level_label})`,
        ];
        if ((chunk.learning_outcomes || []).length > 0) {
          lines.push('Исходи на учење:');
          chunk.learning_outcomes.forEach(o => lines.push(`  ${o}`));
        }
        if ((chunk.keywords || []).length > 0) {
          lines.push(`Клучни зборови: ${chunk.keywords.join(', ')}`);
        }
        return lines.join('\n');
      })
      .join('\n\n');

    const prompt = `Ти си експерт за македонската наставна програма по математика (БРО — bro.gov.mk).
Дадена е една математичка задача и листа од кандидатски наставни теми. Избери ја темата на која НАЈДОБРО припаѓа задачата.

ЗАДАЧА:
Наслов: ${task.title}
Текст: ${(task.original_text || '').slice(0, 1000)}
Тагови: ${(task.tags || []).join(', ') || '—'}
Декларирано ниво: ${task.grade_level || '—'}

${candidatesBlock}

СТРОГИ ПРАВИЛА:
1. topic_id МОРА да биде избран ИСКЛУЧИВО од кандидатите погоре. Ако ниту еден кандидат не одговара на задачата, врати празен topic_id ("") и confidence 0.
2. outcome_codes МОРА да бидат само кодови (пр. "МА.7.5.2") кои веќе постојат во исходите на избраната тема.
3. confidence е број помеѓу 0 и 1 — колку сигурно задачата припаѓа на избраната тема.

Врати СТРОГО JSON објект без дополнителен текст.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic_id: { type: Type.STRING, description: 'topic_id of the best matching candidate, or empty string if none match' },
            outcome_codes: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Only outcome codes that exist on the chosen topic' },
            confidence: { type: Type.NUMBER, description: '0-1 confidence that the task belongs to the chosen topic' },
          },
          required: ['topic_id', 'outcome_codes', 'confidence'],
        },
      },
    });

    if (!response.text) return [];
    const parsed = parseGeminiResponse(response.text);

    // 4. Validate against the actual curriculum data (anti-hallucination)
    const topicId = typeof parsed.topic_id === 'string' ? parsed.topic_id.trim() : '';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    if (!topicId || confidence < MIN_CONFIDENCE) return [];

    const candidate = byTopic.get(topicId);
    if (!candidate) return []; // hallucinated topic_id → reject

    const outcomeCodes = (Array.isArray(parsed.outcome_codes) ? parsed.outcome_codes : [])
      .filter((code: unknown): code is string => typeof code === 'string' && candidate.codes.has(code));

    const { chunk } = candidate;
    return [{
      education_track: chunk.education_track,
      grade: chunk.grade,
      topic_id: topicId,
      topic_name: chunk.topic_name,
      outcome_codes: outcomeCodes,
      confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
      source: 'ai',
    }];
  } catch (error) {
    console.warn('Curriculum classification failed:', error);
    return [];
  }
}

/**
 * Classify multiple tasks and persist curriculum_refs on each Firestore task
 * document. Runs sequentially to stay gentle on rate limits; a single task
 * failure never aborts the batch.
 */
export async function batchClassifyTasks(
  tasks: MathTask[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = tasks.length;
  let done = 0;
  for (const task of tasks) {
    try {
      const refs = await classifyTaskCurriculum(task);
      if (task.id && refs.length > 0) {
        await updateDoc(doc(db, 'tasks', task.id), { curriculum_refs: refs });
      }
    } catch (error) {
      console.warn(`Curriculum classification failed for task ${task.id}:`, error);
    }
    done++;
    onProgress?.(done, total);
  }
}

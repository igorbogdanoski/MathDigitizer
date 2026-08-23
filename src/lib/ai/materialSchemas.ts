/**
 * Typed shapes and response schemas for the material factory
 * (EXPERT_LEVEL_MASTER_PLAN, 6.2).
 *
 * The generator used to describe its output shape in prose inside the prompt
 * and then `JSON.parse` whatever came back, so a malformed response crashed the
 * export and every renderer took `any`. Each material type now declares a real
 * `responseSchema`, and the parsed payload is normalised into a typed object
 * with malformed entries dropped rather than rendered.
 */
import { Type } from '@google/genai';
import type { MaterialType } from './materials';

export interface QuizQuestionMaterial {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface QuizMaterial {
  kind: 'quiz';
  title: string;
  questions: QuizQuestionMaterial[];
}

export interface FlashcardMaterial {
  front: string;
  back: string;
}

export interface FlashcardsMaterial {
  kind: 'flashcards';
  title: string;
  cards: FlashcardMaterial[];
}

export interface SlideMaterial {
  title: string;
  content: string;
  type: 'theory' | 'example' | 'task';
}

export interface PresentationMaterial {
  kind: 'presentation';
  title: string;
  slides: SlideMaterial[];
}

export interface SectionMaterial {
  heading: string;
  content: string;
}

export interface DocumentMaterial {
  kind: 'document';
  title: string;
  sections: SectionMaterial[];
  answerKey?: string;
}

export type EducationalMaterial =
  | QuizMaterial
  | FlashcardsMaterial
  | PresentationMaterial
  | DocumentMaterial;

/** Which of the four payload shapes a material type produces. */
export function materialKind(type: MaterialType): EducationalMaterial['kind'] {
  if (type === 'quiz') return 'quiz';
  if (type === 'flashcards') return 'flashcards';
  if (type === 'presentation') return 'presentation';
  return 'document';
}

/** Gemini response schema for the given material type. */
export function buildMaterialResponseSchema(type: MaterialType): Record<string, unknown> {
  const title = { type: Type.STRING, description: 'Наслов на материјалот на бараниот јазик.' };

  switch (materialKind(type)) {
    case 'quiz':
      return {
        type: Type.OBJECT,
        properties: {
          title,
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: 'Текст на прашањето со LaTeX ($...$).' },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Точно 4 опции.' },
                correctIndex: { type: Type.NUMBER, description: 'Индекс 0-3 на точната опција.' },
              },
              required: ['question', 'options', 'correctIndex'],
            },
          },
        },
        required: ['title', 'questions'],
      };

    case 'flashcards':
      return {
        type: Type.OBJECT,
        properties: {
          title,
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: { type: Type.STRING },
                back: { type: Type.STRING },
              },
              required: ['front', 'back'],
            },
          },
        },
        required: ['title', 'cards'],
      };

    case 'presentation':
      return {
        type: Type.OBJECT,
        properties: {
          title,
          slides: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['theory', 'example', 'task'] },
              },
              required: ['title', 'content', 'type'],
            },
          },
        },
        required: ['title', 'slides'],
      };

    default:
      return {
        type: Type.OBJECT,
        properties: {
          title,
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                content: { type: Type.STRING, description: 'Содржина со LaTeX ($...$) и Markdown.' },
              },
              required: ['heading', 'content'],
            },
          },
          answerKey: { type: Type.STRING, description: 'Клуч со решенија, само за наставникот.' },
        },
        required: ['title', 'sections'],
      };
  }
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

/**
 * Normalises a parsed payload into a typed material.
 *
 * Malformed entries are dropped rather than rendered — a quiz question without
 * four options or with an out-of-range answer index is not something a teacher
 * should be handed.
 */
export function normalizeMaterial(type: MaterialType, parsed: any): EducationalMaterial {
  const kind = materialKind(type);
  const title = str(parsed?.title, 'Материјал');

  if (kind === 'quiz') {
    const questions: QuizQuestionMaterial[] = (Array.isArray(parsed?.questions) ? parsed.questions : [])
      .filter((q: any) =>
        q && str(q.question) &&
        Array.isArray(q.options) && q.options.length === 4 &&
        q.options.every((o: unknown) => typeof o === 'string') &&
        Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3
      )
      .map((q: any) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }));

    return { kind, title, questions };
  }

  if (kind === 'flashcards') {
    const cards: FlashcardMaterial[] = (Array.isArray(parsed?.cards) ? parsed.cards : [])
      .filter((c: any) => c && str(c.front) && str(c.back))
      .map((c: any) => ({ front: c.front, back: c.back }));

    return { kind, title, cards };
  }

  if (kind === 'presentation') {
    const slides: SlideMaterial[] = (Array.isArray(parsed?.slides) ? parsed.slides : [])
      .filter((s: any) => s && str(s.title))
      .map((s: any) => ({
        title: s.title,
        content: str(s.content),
        type: (['theory', 'example', 'task'].includes(s.type) ? s.type : 'theory') as SlideMaterial['type'],
      }));

    return { kind, title, slides };
  }

  const sections: SectionMaterial[] = (Array.isArray(parsed?.sections) ? parsed.sections : [])
    .filter((s: any) => s && (str(s.heading) || str(s.content)))
    .map((s: any) => ({ heading: str(s.heading), content: str(s.content) }));

  const answerKey = str(parsed?.answerKey);
  return { kind: 'document', title, sections, ...(answerKey ? { answerKey } : {}) };
}

/** True when the normalised material has nothing worth showing. */
export function isMaterialEmpty(material: EducationalMaterial): boolean {
  switch (material.kind) {
    case 'quiz': return material.questions.length === 0;
    case 'flashcards': return material.cards.length === 0;
    case 'presentation': return material.slides.length === 0;
    case 'document': return material.sections.length === 0;
  }
}

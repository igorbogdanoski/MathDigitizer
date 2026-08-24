/**
 * What distillation produces from one textbook chapter
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * Adapted from book-to-skill's Step 7 chapter template
 * (github.com/virgiliojr94/book-to-skill), reshaped for what this app actually
 * consumes. Their template targets an agent reading a skill folder; here the
 * consumers are task extraction, grading and the tutor chat, so the sections
 * that earn their place are different:
 *
 * - `misconceptions` replaces their "anti-patterns". In a maths textbook the
 *   thing worth extracting is not a bad practice but the specific wrong move a
 *   student makes — and that is exactly what grading needs in order to say
 *   *why* an answer is wrong instead of only that it is.
 * - `methods` keeps their "Use X when Y" formulation, which is what makes a
 *   framework usable rather than merely named.
 * - `workedExample` is kept because it is the one thing a generator cannot
 *   invent faithfully, and the one a learner returns for.
 * - Their code-example and reference-table sections are dropped: a maths
 *   textbook has neither, and a section that is always empty teaches the model
 *   that empty sections are acceptable.
 *
 * Nothing here maps to a БРО outcome. The chapter is the author's, the codes are
 * the state's, and joining them is a claim about the curriculum — contract §3
 * forbids guessing it from text. A teacher makes that link, in 10.1b's UI.
 */
import { Type } from '@google/genai';

export interface KnowledgeConcept {
  /** The term as the textbook names it. */
  term: string;
  /** One sentence. */
  definition: string;
}

export interface KnowledgeMethod {
  name: string;
  /** The situation that calls for it — "Use X when Y". */
  whenToUse: string;
  /** The steps or criteria, not a restatement of the name. */
  how: string;
}

export interface KnowledgeMisconception {
  /** The wrong move, stated as a student would make it. */
  mistake: string;
  /** Why it is wrong — what grading needs in order to explain itself. */
  why: string;
}

export interface ChapterSkill {
  /** Index of the source chapter in the book. */
  chapterIndex: number;
  /** The chapter's own title, carried through unchanged. */
  chapterTitle: string;
  /** One or two sentences: the single most important thing taught here. */
  coreIdea: string;
  concepts: KnowledgeConcept[];
  methods: KnowledgeMethod[];
  misconceptions: KnowledgeMisconception[];
  /** One example the book works through, compactly reconstructed. */
  workedExample: string;
  /** What a teacher must remember. */
  takeaways: string[];
}

/** Caps that keep one chapter's distillation to a useful size. */
export const MAX_CONCEPTS = 10;
export const MAX_METHODS = 6;
export const MAX_MISCONCEPTIONS = 6;
export const MAX_TAKEAWAYS = 7;

/**
 * The response schema for distilling one chapter.
 *
 * Declared rather than described in prose, for the reason phase 6.2 gave: a
 * generator that explains its shape in the prompt and then parses whatever
 * comes back fails at the parse, in front of the user.
 */
export function buildChapterSkillSchema(): Record<string, unknown> {
  const stringArray = (description: string) => ({
    type: Type.ARRAY,
    description,
    items: { type: Type.STRING },
  });

  return {
    type: Type.OBJECT,
    properties: {
      coreIdea: {
        type: Type.STRING,
        description: 'Една до две реченици: најважното што ова поглавје го учи.',
      },
      concepts: {
        type: Type.ARRAY,
        description: `Најважните поими, најмногу ${MAX_CONCEPTS}.`,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            definition: { type: Type.STRING, description: 'Една реченица.' },
          },
          required: ['term', 'definition'],
        },
      },
      methods: {
        type: Type.ARRAY,
        description: `Постапки, најмногу ${MAX_METHODS}.`,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            whenToUse: { type: Type.STRING, description: 'Во која ситуација се користи.' },
            how: { type: Type.STRING, description: 'Чекорите, не повторување на името.' },
          },
          required: ['name', 'whenToUse', 'how'],
        },
      },
      misconceptions: {
        type: Type.ARRAY,
        description:
          `Типични грешки на ученици за оваа содржина, најмногу ${MAX_MISCONCEPTIONS}. ` +
          'Само ако поглавјето навистина ги спомнува или ако следат директно од него.',
        items: {
          type: Type.OBJECT,
          properties: {
            mistake: { type: Type.STRING, description: 'Погрешниот чекор, како што го прави ученик.' },
            why: { type: Type.STRING, description: 'Зошто е погрешен.' },
          },
          required: ['mistake', 'why'],
        },
      },
      workedExample: {
        type: Type.STRING,
        description:
          'Еден решен пример од поглавјето, збиено реконструиран. ' +
          'Празен стринг ако поглавјето нема ниту еден — не измислувај.',
      },
      takeaways: stringArray(`Што наставникот мора да го запамети, најмногу ${MAX_TAKEAWAYS}.`),
    },
    required: ['coreIdea', 'concepts', 'methods', 'misconceptions', 'workedExample', 'takeaways'],
  };
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Turns a parsed response into a `ChapterSkill`, dropping what is malformed.
 *
 * Entries missing a required half are discarded rather than stored with a blank
 * side: a concept with no definition, or a misconception with no reason, reads
 * on screen as though the book said nothing about it, which is worse than the
 * chapter simply having fewer entries.
 */
export function normalizeChapterSkill(
  parsed: unknown,
  chapterIndex: number,
  chapterTitle: string,
): ChapterSkill {
  const raw = (parsed ?? {}) as Record<string, unknown>;
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

  const concepts: KnowledgeConcept[] = list(raw.concepts)
    .map(entry => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return { term: text(item.term), definition: text(item.definition) };
    })
    .filter(c => c.term && c.definition)
    .slice(0, MAX_CONCEPTS);

  const methods: KnowledgeMethod[] = list(raw.methods)
    .map(entry => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return { name: text(item.name), whenToUse: text(item.whenToUse), how: text(item.how) };
    })
    .filter(m => m.name && m.whenToUse && m.how)
    .slice(0, MAX_METHODS);

  const misconceptions: KnowledgeMisconception[] = list(raw.misconceptions)
    .map(entry => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return { mistake: text(item.mistake), why: text(item.why) };
    })
    .filter(m => m.mistake && m.why)
    .slice(0, MAX_MISCONCEPTIONS);

  const takeaways = list(raw.takeaways)
    .map(text)
    .filter(Boolean)
    .slice(0, MAX_TAKEAWAYS);

  return {
    chapterIndex,
    chapterTitle,
    coreIdea: text(raw.coreIdea),
    concepts,
    methods,
    misconceptions,
    workedExample: text(raw.workedExample),
    takeaways,
  };
}

/**
 * Whether a distilled chapter carries anything worth storing.
 *
 * A chapter that produced only a core idea is a chapter the model had nothing
 * to say about — usually a title page or an index that segmentation could not
 * tell from content. Storing it would put an entry in the teacher's knowledge
 * base that costs a retrieval slot and returns nothing.
 */
export function isChapterSkillEmpty(skill: ChapterSkill): boolean {
  return (
    skill.concepts.length === 0 &&
    skill.methods.length === 0 &&
    skill.misconceptions.length === 0 &&
    skill.takeaways.length === 0
  );
}

/**
 * A prompt-ready rendering of one distilled chapter.
 *
 * Sections the chapter has nothing for are left out entirely rather than
 * printed with a dash: an empty heading spends tokens telling the model that
 * blank sections are normal output.
 */
export function formatChapterSkill(skill: ChapterSkill): string {
  const lines: string[] = [`## ${skill.chapterTitle}`];

  if (skill.coreIdea) lines.push(`Суштина: ${skill.coreIdea}`);

  if (skill.concepts.length) {
    lines.push('Поими:');
    lines.push(...skill.concepts.map(c => `  • ${c.term} — ${c.definition}`));
  }
  if (skill.methods.length) {
    lines.push('Постапки:');
    lines.push(...skill.methods.map(m => `  • ${m.name} (кога: ${m.whenToUse}) — ${m.how}`));
  }
  if (skill.misconceptions.length) {
    lines.push('Типични грешки:');
    lines.push(...skill.misconceptions.map(m => `  • ${m.mistake} — ${m.why}`));
  }
  if (skill.workedExample) lines.push(`Решен пример: ${skill.workedExample}`);
  if (skill.takeaways.length) {
    lines.push('Клучно:');
    lines.push(...skill.takeaways.map(tk => `  • ${tk}`));
  }

  return lines.join('\n');
}

/**
 * БРО curriculum taxonomy for analytics
 * (EXPERT_LEVEL_MASTER_PLAN, 7.2).
 *
 * Outcome codes are `МА.<grade>.<topic>.<outcome>`, where the topic segment is
 * an index *within a grade* — so `МА.1.1.x` and `МА.7.1.x` are unrelated. That
 * makes the raw code useless for a cross-grade rollup: a teacher wants to see
 * "weak in Geometry", not "weak in МА.7.1".
 *
 * This module maps codes and topics onto the five official БРО subject domains,
 * and carries the vertical progression between grades, so a weakness can point
 * at the prerequisite it most likely rests on.
 *
 * Progression source: the author's own curriculum repository
 * (math-curriculum-ai-navigator, data/verticalProgression.ts), derived from the
 * БРО programmes for VI–IX.
 */

export type MathDomain = 'numbers' | 'geometry' | 'algebra' | 'measurement' | 'data';

export const MATH_DOMAINS: MathDomain[] = ['numbers', 'geometry', 'algebra', 'measurement', 'data'];

/** Official БРО theme names. */
export const DOMAIN_LABELS: Record<MathDomain, string> = {
  numbers: 'Броеви и множества',
  geometry: 'Геометрија',
  algebra: 'Алгебра',
  measurement: 'Мерење',
  data: 'Работа со податоци и веројатност',
};

/**
 * Keyword signatures per domain.
 * Ordered by specificity: algebra and measurement terms are checked before the
 * broader number vocabulary, because "равенка со дропки" is algebra, not numbers.
 */
const DOMAIN_KEYWORDS: Array<{ domain: MathDomain; keywords: string[] }> = [
  {
    domain: 'data',
    keywords: [
      'податоц', 'веројатн', 'статист', 'дијаграм', 'табела на честот', 'фреквенц',
      'медијана', 'аритметичка средина', 'мод', 'примерок', 'популациј', 'корелациј',
      'комбинатор', 'настан', 'пиктограм', 'графикон',
    ],
  },
  {
    domain: 'measurement',
    keywords: [
      'мерењ', 'мерн', 'единиц', 'периметар', 'плоштин', 'волумен', 'зафатнин',
      'должин', 'маса', 'време', 'температур', 'агол во степени', 'хектар', 'литар',
    ],
  },
  {
    domain: 'algebra',
    keywords: [
      'алгебар', 'равенк', 'неравенств', 'израз', 'полином', 'функциј', 'систем',
      'променлив', 'пропорционалн', 'линеарн', 'квадратн', 'експоненциј', 'логаритам',
      'низа', 'прогресиј', 'извод', 'интеграл', 'граничн', 'лимес', 'матриц',
    ],
  },
  {
    domain: 'geometry',
    keywords: [
      'геометр', 'триаголник', 'многуаголник', 'четириаголник', 'кружниц', 'круг',
      'агол', 'отсечк', 'права', 'симетр', 'ротациј', 'транслациј', 'вектор',
      'призм', 'пирамид', 'цилиндар', 'конус', 'сфер', 'тела', 'фигур', 'форм',
      'тригоном', 'синус', 'косинус', 'координатн систем', 'аналитичка геометр',
    ],
  },
  {
    domain: 'numbers',
    keywords: [
      'број', 'броењ', 'множеств', 'дропк', 'децимал', 'процент', 'цел', 'природн',
      'рационалн', 'реалн', 'ирационалн', 'делив', 'делител', 'содржател',
      'степен', 'корен', 'апсолутна вредност', 'размер', 'операциј', 'собирањ',
      'одземањ', 'множењ', 'делењ',
    ],
  },
];

const normalize = (value: string): string => (value || '').toLowerCase();

/**
 * Classifies a topic (name plus any keywords the curriculum carries) into one
 * of the five domains. Returns null when nothing matches, so a caller can
 * report "unclassified" instead of silently bucketing it into Numbers.
 */
export function classifyDomain(topicName: string, extraKeywords: readonly string[] = []): MathDomain | null {
  const haystack = normalize([topicName, ...extraKeywords].join(' '));
  if (!haystack.trim()) return null;

  for (const { domain, keywords } of DOMAIN_KEYWORDS) {
    if (keywords.some(keyword => haystack.includes(keyword))) return domain;
  }
  return null;
}

/** Parsed shape of an outcome code such as `МА.7.5.2` or `МА.8.1.1.1`. */
export interface ParsedOutcomeCode {
  grade: string;
  topicIndex: number;
  outcomeIndex: number;
  /** Present where the programme numbers a subtopic level, as grade 8 does. */
  subtopicIndex?: number;
}

/**
 * Parses an outcome code.
 *
 * Two numbering depths exist in the corpus: most programmes number
 * `PREFIX.GRADE.TOPIC.OUTCOME`, while grade 8 carries an extra subtopic level
 * (`МА.8.1.1.1`). Both are legitimate; a parser that only knew the shorter one
 * left every grade-8 outcome ungraded in the mastery rollup.
 */
export function parseOutcomeCode(code: string): ParsedOutcomeCode | null {
  const match = /^[А-ШA-Z]{2}\.([^.]+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec((code || '').trim());
  if (!match) return null;

  const [, grade, topic, third, fourth] = match;

  return fourth === undefined
    ? { grade, topicIndex: Number(topic), outcomeIndex: Number(third) }
    : { grade, topicIndex: Number(topic), subtopicIndex: Number(third), outcomeIndex: Number(fourth) };
}

/** Grade token out of an outcome code, for grouping a rollup by year. */
export function gradeOfCode(code: string): string | null {
  return parseOutcomeCode(code)?.grade ?? null;
}

// ─── Vertical progression (VI–IX) ────────────────────────────────────────────

export interface ProgressionStep {
  /** Roman grade label as the БРО programme writes it. */
  grade: 'VI' | 'VII' | 'VIII' | 'IX';
  /** Concepts introduced at this grade, verbatim from the programme. */
  concepts: string;
  /** Learning outcomes at this grade. */
  outcomes: string;
}

export const GRADE_ORDER: ProgressionStep['grade'][] = ['VI', 'VII', 'VIII', 'IX'];

/** Arabic grade token ("6"…"9") for a Roman progression label. */
export const ROMAN_TO_GRADE: Record<ProgressionStep['grade'], string> = {
  VI: '6', VII: '7', VIII: '8', IX: '9',
};

export function romanForGrade(grade: string): ProgressionStep['grade'] | null {
  const entry = Object.entries(ROMAN_TO_GRADE).find(([, arabic]) => arabic === grade);
  return (entry?.[0] as ProgressionStep['grade']) ?? null;
}

/**
 * What each domain covers at each grade, VI→IX.
 * Ported from the author's curriculum repository; the text is the БРО wording.
 */
export const VERTICAL_PROGRESSION: Record<MathDomain, ProgressionStep[]> = {
  numbers: [
    { grade: 'VI', concepts: 'Множество, ℕ, ℕ₀, подмножество (⊆), вистинско подмножество (⊂), позитивни рационални броеви (дропки, децимали)', outcomes: 'Користи знаења за множества за да ги објасни и запише ℕ, ℕ₀ и позитивните рационални броеви.' },
    { grade: 'VII', concepts: 'Цели броеви (ℤ), апсолутна вредност, операции со множества (унија ∪, пресек ∩, разлика \\, Декартов производ ×), периодични децимални броеви', outcomes: 'Ги применува операциите со множества во решавање проблеми. Применува цели броеви и апсолутна вредност. Користи врска меѓу дропки, децимални броеви и проценти.' },
    { grade: 'VIII', concepts: 'Релации, рационални броеви (ℚ⁺, ℚ⁻, ℚ), периодични децимални броеви, размер, права и обратна пропорционалност, степени и корени (квадратен и кубен)', outcomes: 'Решава проблеми со релации. Применува еднаквост на дропки, децимални броеви и проценти. Решава проблеми со размер и пропорционалност. Користи степени и корени.' },
    { grade: 'IX', concepts: 'Реални броеви (𝕀, ℝ), интервали, инверзна релација, пропорција, геометриска средина, степени со негативен показател', outcomes: 'Решава проблеми со релации и инверзни релации. Користи познати факти за интервали. Користи степени со негативен показател. Решава проблеми со процент, размер и пропорција.' },
  ],
  geometry: [
    { grade: 'VI', concepts: 'Отсечка, агол, симетрали, соседни/накрсни/напоредни агли, кружница/круг (радиус, дијаметар, тетива), многуаголник (дијагонали), висина/тежишна линија кај триаголник, мрежа на цилиндар, ротација', outcomes: 'Открива својства на агли, триаголници и круг. Анализира 3Д-форми преку мрежи. Трансформира 2Д-форми со ротација.' },
    { grade: 'VII', concepts: 'Складни триаголници, конструкции, четириаголници и нивни својства, симетрала на агол и отсечка, координатен систем', outcomes: 'Ги применува својствата на триаголници и четириаголници. Конструира геометриски фигури. Работи во координатен систем.' },
    { grade: 'VIII', concepts: 'Питагорова теорема, слични триаголници, размери на страни, кружница и агли во кружница, призма и пирамида', outcomes: 'Ја применува Питагоровата теорема. Решава проблеми со сличност. Анализира просторни тела.' },
    { grade: 'IX', concepts: 'Правилни многуаголници, цилиндар, конус, сфера, тригонометриски односи во правоаголен триаголник, векторска и координатна геометрија', outcomes: 'Решава проблеми со правилни многуаголници и ротациони тела. Користи тригонометриски односи.' },
  ],
  algebra: [
    { grade: 'VI', concepts: 'Буквени изрази, вредност на израз, едноставни равенки со една непозната', outcomes: 'Составува и пресметува вредност на едноставни изрази. Решава едноставни равенки.' },
    { grade: 'VII', concepts: 'Алгебарски изрази, собирање и одземање изрази, линеарни равенки, неравенства', outcomes: 'Оперира со алгебарски изрази. Решава линеарни равенки и неравенства.' },
    { grade: 'VIII', concepts: 'Множење изрази, формули за скратено множење, линеарна функција, систем од две равенки', outcomes: 'Применува формули за скратено множење. Претставува и толкува линеарна функција. Решава системи равенки.' },
    { grade: 'IX', concepts: 'Квадратна равенка и функција, разложување на множители, рационални изрази, низи', outcomes: 'Решава квадратни равенки. Анализира квадратна функција. Работи со рационални изрази.' },
  ],
  measurement: [
    { grade: 'VI', concepts: 'Мерни единици за должина, маса, време; периметар и плоштина на правоаголник и триаголник', outcomes: 'Претвора мерни единици. Пресметува периметар и плоштина на основни фигури.' },
    { grade: 'VII', concepts: 'Плоштина на четириаголници, периметар и плоштина на круг, волумен на призма', outcomes: 'Пресметува плоштина на четириаголници и круг. Пресметува волумен на призма.' },
    { grade: 'VIII', concepts: 'Плоштина и волумен на призма и пирамида, мерни единици за плоштина и волумен', outcomes: 'Користи мерни единици за време. Избира соодветни мерни единици за должина, плоштина и волумен.' },
    { grade: 'IX', concepts: 'Периметар и плоштина на правилни многуаголници, плоштина и волумен на цилиндар и конус, мерни единици ар (а) и хектар (ha)', outcomes: 'Користи мерни единици за време. Избира соодветни мерни единици за должина, плоштина и волумен.' },
  ],
  data: [
    { grade: 'VI', concepts: 'Ранг, медијана, аритметичка средина, табели на честота, дијаграми (кружен, столбест, линиски), сигурен/невозможен/еднакво веројатен настан', outcomes: 'Толкува табели и дијаграми и носи заклучоци. Проценува настан и веројатност.' },
    { grade: 'VII', concepts: 'Планирање истражување, дискретни/групирани податоци, модална класа, дијаграми на фреквенција, пиктограм, експериментална и теоретска веројатност', outcomes: 'Собира, организира и претставува дискретни податоци. Толкува податоци и донесува заклучоци. Користи јазик на веројатноста.' },
    { grade: 'VIII', concepts: 'Популација, репрезентативен примерок, стебло-лист дијаграм, спротивен/независен/зависен настан, веројатност на спротивен настан (1−p)', outcomes: 'Креира план за истражување со избор на примерок. Презентира и толкува резултати. Решава проблеми со веројатност.' },
    { grade: 'IX', concepts: 'Непрекинати/континуирани податоци, полигон на фреквенција, дијаграм со точки, корелација, распределба на податоци, релативна фреквенција, последователни настани', outcomes: 'Користи технологии за анализа на дискретни и непрекинати податоци. Користи концепти на веројатност и релативна фреквенција.' },
  ],
};

/**
 * The step a weakness most likely rests on: the same domain, one grade down.
 *
 * This is what makes a weakness actionable — "weak in Geometry at VIII" is a
 * label, "revisit the VII geometry the VIII work builds on" is a next step.
 */
export function prerequisiteStep(domain: MathDomain, grade: string): ProgressionStep | null {
  const roman = romanForGrade(grade);
  if (!roman) return null;

  const index = GRADE_ORDER.indexOf(roman);
  if (index <= 0) return null;

  const previous = GRADE_ORDER[index - 1];
  return VERTICAL_PROGRESSION[domain].find(step => step.grade === previous) ?? null;
}

/** What a domain covers at a given grade, when the grade is in VI–IX. */
export function progressionStep(domain: MathDomain, grade: string): ProgressionStep | null {
  const roman = romanForGrade(grade);
  if (!roman) return null;
  return VERTICAL_PROGRESSION[domain].find(step => step.grade === roman) ?? null;
}

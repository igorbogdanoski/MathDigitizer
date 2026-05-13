import { buildPromptEnvelope, PromptStrategy } from './promptEngineering';
import { PedagogyPriority } from './pedagogyPolicy';

export type PedagogyQADimension = 'protocol' | 'theory' | 'safety' | 'outputContract' | 'retrieval';

export const PEDAGOGY_QA_DIMENSION_THRESHOLDS: Record<PedagogyQADimension, number> = {
  protocol: 7,
  theory: 7,
  safety: 7,
  outputContract: 5,
  retrieval: 2,
};

export const PEDAGOGY_QA_TOTAL_THRESHOLDS = {
  pass: 42,
  warn: 30,
};

export interface PedagogyQARubricScore {
  score: number;
  maxScore: number;
  status: 'pass' | 'warn' | 'fail';
  notes: string[];
}

export interface PedagogyQARubricResult {
  totalScore: number;
  maxScore: number;
  status: 'pass' | 'warn' | 'fail';
  breakdown: {
    protocol: PedagogyQARubricScore;
    theory: PedagogyQARubricScore;
    safety: PedagogyQARubricScore;
    outputContract: PedagogyQARubricScore;
    retrieval: PedagogyQARubricScore;
  };
}

export interface PedagogyQAGoldenPrompt {
  id: string;
  label: string;
  priority: PedagogyPriority;
  strategy?: PromptStrategy;
  role: string;
  mission: string;
  userInput: string;
  ragContext?: string;
  outputContract: string;
  expectedTokens: string[];
}

export const PEDAGOGY_GOLDEN_PROMPTS: PedagogyQAGoldenPrompt[] = [
  {
    id: 'scaffolded-linear-equation',
    label: 'Скелирана линеарна равенка',
    priority: 'scaffolded',
    role: 'Врвен едукативен систем за математика',
    mission: 'Помогни на ученик да реши основна равенка со постепени насоки.',
    strategy: 'hybrid',
    userInput: 'Реши ја равенката $x + 5 = 12$ така што ќе го водиш ученикот чекор по чекор.',
    ragContext: 'RAG: Релевантни задачи за собирање и одземање со непозната.',
    outputContract: '{"steps":["string"],"hint":"string","selfCheck":"string"}',
    expectedTokens: ['Concrete -> Representational -> Abstract', 'ПЕДАГОШКИ ПРОТОКОЛ', 'steps', 'hint', 'selfCheck']
  },
  {
    id: 'balanced-area-problem',
    label: 'Баланс-ен проблем со плоштина',
    priority: 'balanced',
    role: 'Педагошки генератор на математички одговори',
    mission: 'Објасни плоштина со јасен пример и кратка мини-вежба.',
    strategy: 'tot',
    userInput: 'Објасни како се пресметува плоштина на правоаголник и дај мини-вежба.',
    outputContract: '{"explanation":"string","example":"string","practice":"string"}',
    expectedTokens: ['1 краток пример', '1 мини-вежба', 'Bloom', 'DoK', 'ПЕДАГОШКИ ПРОТОКОЛ']
  },
  {
    id: 'mastery-proof-check',
    label: 'Мастерство со верификација',
    priority: 'mastery',
    role: 'EdTech математика асистент',
    mission: 'Провери решение и побарај алтернативна верификација.',
    strategy: 'hybrid',
    userInput: 'Провери го решението и покажи како можеме да го верификуваме со друг метод.',
    ragContext: 'RAG: Поддржувачки пример за верификација и ретроспективно повторување.',
    outputContract: '{"verification":"string","alternateMethod":"string"}',
    expectedTokens: ['алтернативен метод', 'верификација', 'verification', 'RAG', 'ПЕДАГОШКИ ПРОТОКОЛ']
  },
  {
    id: 'edge-negative-numbers-misconception',
    label: 'Edge: Негативни броеви и мисконцепции',
    priority: 'scaffolded',
    strategy: 'cot',
    role: 'Математика тютор за рана адолесценција',
    mission: 'Дијагностицирај и коригирај типични грешки со негативни броеви.',
    userInput: 'Ученик тврди дека $-3 - 5 = 2$. Објасни зошто е грешка и води го до точен резултат без да го демотивираш.',
    ragContext: 'RAG: Примери со бројна права и операции со негативни броеви.',
    outputContract: '{"diagnosis":"string","microSteps":["string"],"misconceptions":[{"mistake":"string","teacherReaction":"string"}],"selfCheck":"string"}',
    expectedTokens: ['Socratic', 'microSteps', 'misconceptions', 'selfCheck', 'валиден JSON']
  },
  {
    id: 'difficult-multi-step-word-problem',
    label: 'Difficult: Мулти-чекор текстуална задача',
    priority: 'balanced',
    strategy: 'tot',
    role: 'Експерт за структуриран проблем-солвинг',
    mission: 'Изгради повеќепатен план за сложена текстуална задача и избери најпедагошки пат.',
    userInput: 'Во продавница има 3 типа пакети. Од првиот се продаваат 2x, од вториот x+4, од третиот 3x-2, вкупно 44. Најди x и интерпретирај го резултатот.',
    ragContext: 'RAG: Слични задачи со систематско поставување равенка и интерпретација.',
    outputContract: '{"paths":["string"],"chosenPath":"string","solutionSteps":["string"],"finalAnswer":"string","transferTask":"string"}',
    expectedTokens: ['Tree-of-Thought', 'paths', 'chosenPath', 'solutionSteps', 'transferTask']
  },
  {
    id: 'edge-low-context-high-safety',
    label: 'Edge: Низок контекст, висока безбедност',
    priority: 'mastery',
    strategy: 'sos',
    role: 'Безбеден педагошки асистент за математика',
    mission: 'Дај внимателен одговор кога влезот е недоволен и постави јасни граници на сигурност.',
    userInput: 'Реши го ова: "Онаа формула од вчера".',
    outputContract: '{"clarifyingQuestions":["string"],"safeAssumptions":["string"],"provisionalGuidance":"string"}',
    expectedTokens: ['Self-Organized Solving', 'clarifyingQuestions', 'safeAssumptions', 'точност', 'no markdown']
  }
];

export function evaluatePedagogyPrompt(prompt: string): PedagogyQARubricResult {
  const normalized = prompt.toLowerCase();

  const protocolChecks = [
    'concrete -> representational -> abstract',
    'socratic',
    'bloom',
    'dok',
    'metacognitive checkpoint'
  ];
  const hasProtocolCoverage = protocolChecks.filter((token) => normalized.includes(token)).length;
  const protocol = hasProtocolCoverage >= 4
    ? { score: 10, maxScore: 10, status: 'pass' as const, notes: ['Theoretical pedagogy coverage is strong.'] }
    : hasProtocolCoverage >= 2
      ? { score: 7, maxScore: 10, status: 'warn' as const, notes: ['Pedagogy coverage is partial.'] }
      : { score: 3, maxScore: 10, status: 'fail' as const, notes: ['Pedagogy coverage is weak.'] };

  const theoryTokens = ['scaffold', 'zpd', 'bloom', 'dok', 'self-check', 'retrieval'];
  const theoryCoverage = theoryTokens.filter((token) => normalized.includes(token)).length;
  const theory = theoryCoverage >= 4
    ? { score: 10, maxScore: 10, status: 'pass' as const, notes: ['Learning-theory anchors are present.'] }
    : theoryCoverage >= 2
      ? { score: 7, maxScore: 10, status: 'warn' as const, notes: ['Learning-theory anchors are partial.'] }
      : { score: 2, maxScore: 10, status: 'fail' as const, notes: ['Learning-theory anchors are missing.'] };

  const safetyTokens = ['валиден json', 'json', 'zero-error', 'точност', 'no markdown'];
  const safetyCoverage = safetyTokens.filter((token) => normalized.includes(token)).length;
  const safety = safetyCoverage >= 4
    ? { score: 10, maxScore: 10, status: 'pass' as const, notes: ['Output safety and contract discipline are strong.'] }
    : safetyCoverage >= 2
      ? { score: 7, maxScore: 10, status: 'warn' as const, notes: ['Output contract discipline is partial.'] }
      : { score: 3, maxScore: 10, status: 'fail' as const, notes: ['Output contract discipline is weak.'] };

  const contractTokens = ['формат на излез', 'output contract', 'json', 'structure'];
  const contractCoverage = contractTokens.filter((token) => normalized.includes(token)).length;
  const outputContract = contractCoverage >= 3
    ? { score: 10, maxScore: 10, status: 'pass' as const, notes: ['Output contract is explicit.'] }
    : contractCoverage >= 1
      ? { score: 5, maxScore: 10, status: 'warn' as const, notes: ['Output contract is only partially explicit.'] }
      : { score: 0, maxScore: 10, status: 'fail' as const, notes: ['Output contract is missing.'] };

  const ragTokens = ['rag', 'retrieval', 'bibliotek', 'library'];
  const ragCoverage = ragTokens.filter((token) => normalized.includes(token)).length;
  const retrieval = ragCoverage >= 2
    ? { score: 10, maxScore: 10, status: 'pass' as const, notes: ['Retrieval-aware grounding is present.'] }
    : ragCoverage >= 1
      ? { score: 6, maxScore: 10, status: 'warn' as const, notes: ['Retrieval grounding is partial.'] }
      : { score: 2, maxScore: 10, status: 'fail' as const, notes: ['Retrieval grounding is missing.'] };

  const totalScore = protocol.score + theory.score + safety.score + outputContract.score + retrieval.score;
  const maxScore = protocol.maxScore + theory.maxScore + safety.maxScore + outputContract.maxScore + retrieval.maxScore;

  const thresholdFailures = (Object.keys(PEDAGOGY_QA_DIMENSION_THRESHOLDS) as PedagogyQADimension[]).filter((dimension) => {
    const threshold = PEDAGOGY_QA_DIMENSION_THRESHOLDS[dimension];
    return ({ protocol, theory, safety, outputContract, retrieval }[dimension].score < threshold);
  });

  let status: PedagogyQARubricResult['status'];
  if (thresholdFailures.length > 0) {
    status = 'fail';
  } else if (totalScore >= PEDAGOGY_QA_TOTAL_THRESHOLDS.pass) {
    status = 'pass';
  } else if (totalScore >= PEDAGOGY_QA_TOTAL_THRESHOLDS.warn) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  return {
    totalScore,
    maxScore,
    status,
    breakdown: {
      protocol,
      theory,
      safety,
      outputContract,
      retrieval,
    },
  };
}

export function buildPedagogyQaPrompt(goldenPrompt: PedagogyQAGoldenPrompt): string {
  return buildPromptEnvelope({
    role: goldenPrompt.role,
    mission: goldenPrompt.mission,
    userInput: goldenPrompt.userInput,
    strategy: goldenPrompt.strategy ?? 'hybrid',
    ragContext: goldenPrompt.ragContext,
    outputContract: goldenPrompt.outputContract,
    pedagogyPriority: goldenPrompt.priority,
    includePedagogyProtocol: true,
    hardRules: [
      'Проверката мора да остане педагошки дефензибилна.',
      'Фокусирај се на објаснување, скелирање и верификација.',
      'Врати исклучиво валиден JSON.',
      'Zero-Error точност за математички искази.',
      'No markdown блокови во финален output.'
    ]
  });
}

export function runPedagogyQaHarness() {
  return PEDAGOGY_GOLDEN_PROMPTS.map((prompt) => {
    const builtPrompt = buildPedagogyQaPrompt(prompt);
    const result = evaluatePedagogyPrompt(builtPrompt);
    const hasAllExpectedTokens = prompt.expectedTokens.every((token) => builtPrompt.toLowerCase().includes(token.toLowerCase()));

    return {
      id: prompt.id,
      label: prompt.label,
      builtPrompt,
      result,
      hasAllExpectedTokens,
    };
  });
}

export function buildPedagogyQaSummary() {
  const results = runPedagogyQaHarness();
  const total = results.length;
  const passed = results.filter((entry) => entry.result.status === 'pass').length;
  const warned = results.filter((entry) => entry.result.status === 'warn').length;
  const failed = results.filter((entry) => entry.result.status === 'fail').length;

  const averageScore = results.reduce((acc, entry) => acc + entry.result.totalScore, 0) / Math.max(total, 1);
  const tokenCoverage = results.filter((entry) => entry.hasAllExpectedTokens).length;

  return {
    total,
    passed,
    warned,
    failed,
    averageScore,
    tokenCoverage,
    perDimensionThresholds: PEDAGOGY_QA_DIMENSION_THRESHOLDS,
    totalThresholds: PEDAGOGY_QA_TOTAL_THRESHOLDS,
    generatedAt: new Date().toISOString(),
    results,
  };
}

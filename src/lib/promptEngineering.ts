import { MathTask } from './schema';
import { getPedagogyHardRules, getPedagogyProtocol, PedagogyPriority } from './pedagogyPolicy';

export type PromptStrategy = 'default' | 'cot' | 'tot' | 'sos' | 'hybrid';

export interface PromptEnvelopeOptions {
  role: string;
  mission: string;
  userInput: string;
  strategy?: PromptStrategy;
  ragContext?: string;
  outputContract: string;
  hardRules?: string[];
  pedagogyPriority?: PedagogyPriority;
  includePedagogyProtocol?: boolean;
}

export function getStrategyDirective(strategy: PromptStrategy = 'hybrid'): string {
  switch (strategy) {
    case 'cot':
      return 'Користи Chain-of-Thought со јасни микро-чекори, но не откривај приватни внатрешни размислувања што не се потребни за ученикот.';
    case 'tot':
      return 'Користи Tree-of-Thought: евалуирај повеќе патишта, спореди ги и избери најпедагошки и математички најточен пат.';
    case 'sos':
      return 'Користи Self-Organized Solving: планирај, решавај во фази, направи кратка самопроверка и корекција пред финален одговор.';
    case 'hybrid':
      return 'Користи хибридна стратегија ToT + CoT + кратка Self-Check фаза за стабилност и педагошка јасност.';
    case 'default':
    default:
      return 'Користи стабилен, педагошки структуриран пристап со јасни чекори и математичка точност.';
  }
}

export function buildRagTaskContext(tasks: MathTask[]): string {
  if (!tasks.length) {
    return 'RAG КОНТЕКСТ: Нема релевантни задачи од библиотеката за ова барање.';
  }

  const lines = tasks.map((task, index) => {
    const textSnippet = task.original_text?.slice(0, 220) ?? '';
    const stepSnippet = task.solution_steps?.[0]?.slice(0, 160) ?? '';
    return [
      `- Пример ${index + 1}`,
      `  Наслов: ${task.title || 'Без наслов'}`,
      `  Тема: ${task.curriculum_topic || 'Непозната тема'}`,
      `  Тежина: ${task.difficulty || 'medium'}`,
      `  Текст (извадок): ${textSnippet}`,
      `  Клучен чекор (извадок): ${stepSnippet}`
    ].join('\n');
  });

  return `RAG КОНТЕКСТ ОД БИБЛИОТЕКА:\n${lines.join('\n')}`;
}

export function buildPromptEnvelope(options: PromptEnvelopeOptions): string {
  const strategy = options.strategy ?? 'hybrid';
  const includePedagogyProtocol = options.includePedagogyProtocol ?? true;
  const pedagogyPriority = options.pedagogyPriority ?? 'balanced';
  const policyRules = getPedagogyHardRules({ priority: pedagogyPriority });
  const userRules = options.hardRules ?? [];
  const rules = [...policyRules, ...userRules];
  const pedagogyProtocol = getPedagogyProtocol({ priority: pedagogyPriority });

  return [
    options.role,
    '',
    `МИСИЈА: ${options.mission}`,
    `СТРАТЕГИЈА: ${getStrategyDirective(strategy)}`,
    ...(includePedagogyProtocol
      ? [
          '',
          'ПЕДАГОШКИ ПРОТОКОЛ (THEORY-BACKED):',
          ...pedagogyProtocol.map((item, idx) => `${idx + 1}. ${item}`)
        ]
      : []),
    '',
    options.ragContext || 'RAG КОНТЕКСТ: Нема достапен дополнителен контекст.',
    '',
    'ВЛЕЗ ОД КОРИСНИК:',
    options.userInput,
    '',
    'ТВРДИ ПРАВИЛА:',
    ...(rules.length ? rules.map((rule, idx) => `${idx + 1}. ${rule}`) : ['1. Почитувај математичка точност и јасност.']),
    '',
    'ФОРМАТ НА ИЗЛЕЗ:',
    options.outputContract
  ].join('\n');
}

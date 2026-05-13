import { describe, expect, it } from 'vitest';
import { buildPromptEnvelope, getStrategyDirective } from './promptEngineering';

describe('promptEngineering', () => {
  it('returns a stable directive for hybrid strategy', () => {
    const directive = getStrategyDirective('hybrid');
    expect(directive).toContain('ToT + CoT');
  });

  it('builds prompt envelope with strategy, context and output contract', () => {
    const prompt = buildPromptEnvelope({
      role: 'Тест улога',
      mission: 'Тест мисија',
      userInput: 'Пресметај 2+2',
      strategy: 'sos',
      pedagogyPriority: 'scaffolded',
      ragContext: 'RAG: пример контекст',
      outputContract: '{"result":"number"}',
      hardRules: ['Врати валиден JSON']
    });

    expect(prompt).toContain('СТРАТЕГИЈА:');
    expect(prompt).toContain('Self-Organized Solving');
    expect(prompt).toContain('ПЕДАГОШКИ ПРОТОКОЛ');
    expect(prompt).toContain('Concrete -> Representational -> Abstract');
    expect(prompt).toContain('RAG: пример контекст');
    expect(prompt).toContain('{"result":"number"}');
  });

  it('can disable pedagogy protocol section explicitly', () => {
    const prompt = buildPromptEnvelope({
      role: 'Тест улога',
      mission: 'Тест мисија',
      userInput: 'Пресметај 2+2',
      strategy: 'default',
      includePedagogyProtocol: false,
      outputContract: '{"result":"number"}'
    });

    expect(prompt).not.toContain('ПЕДАГОШКИ ПРОТОКОЛ');
  });
});

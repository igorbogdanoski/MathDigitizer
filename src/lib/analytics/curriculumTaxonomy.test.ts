import { describe, it, expect } from 'vitest';
import {
  DOMAIN_LABELS,
  MATH_DOMAINS,
  VERTICAL_PROGRESSION,
  classifyDomain,
  gradeOfCode,
  parseOutcomeCode,
  prerequisiteStep,
  progressionStep,
  romanForGrade,
} from './curriculumTaxonomy';

describe('classifyDomain', () => {
  it('recognises each of the five official domains', () => {
    expect(classifyDomain('Броеви и броење')).toBe('numbers');
    expect(classifyDomain('Геометрија')).toBe('geometry');
    expect(classifyDomain('Линеарни равенки')).toBe('algebra');
    expect(classifyDomain('Мерење и мерни единици')).toBe('measurement');
    expect(classifyDomain('Работа со податоци')).toBe('data');
  });

  it('prefers the more specific domain when vocabularies overlap', () => {
    // "равенка со дропки" is algebra, even though "дропк" is number vocabulary
    expect(classifyDomain('Равенки со дропки')).toBe('algebra');
    // Area is measurement, though it appears inside geometry topics
    expect(classifyDomain('Плоштина на триаголник')).toBe('measurement');
  });

  it('uses the extra keywords a curriculum topic carries', () => {
    expect(classifyDomain('Тема 4', ['веројатност', 'настан'])).toBe('data');
  });

  it('returns null instead of guessing', () => {
    expect(classifyDomain('Повторување')).toBeNull();
    expect(classifyDomain('')).toBeNull();
    expect(classifyDomain('   ')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(classifyDomain('ТРИГОНОМЕТРИЈА')).toBe('geometry');
  });

  it('recognises upper-secondary vocabulary', () => {
    expect(classifyDomain('Изводи и примена')).toBe('algebra');
    expect(classifyDomain('Комбинаторика и веројатност')).toBe('data');
    expect(classifyDomain('Аналитичка геометрија')).toBe('geometry');
  });
});

describe('parseOutcomeCode', () => {
  it('parses a primary code', () => {
    expect(parseOutcomeCode('МА.7.5.2')).toEqual({ grade: '7', topicIndex: 5, outcomeIndex: 2 });
  });

  it('parses secondary grade tokens', () => {
    expect(parseOutcomeCode('МА.2год.3.1')?.grade).toBe('2год');
    expect(parseOutcomeCode('МА.4год-миг.1.1')?.grade).toBe('4год-миг');
    expect(parseOutcomeCode('МА.3год-струк.2.4')?.grade).toBe('3год-струк');
  });

  it('rejects anything that is not an outcome code', () => {
    expect(parseOutcomeCode('I-A.1')).toBeNull();
    expect(parseOutcomeCode('МА.7.5')).toBeNull();
    expect(parseOutcomeCode('')).toBeNull();
    expect(parseOutcomeCode('nonsense')).toBeNull();
  });

  it('exposes the grade directly', () => {
    expect(gradeOfCode('МА.8.2.1')).toBe('8');
    expect(gradeOfCode('broken')).toBeNull();
  });
});

describe('vertical progression', () => {
  it('covers every domain across VI–IX', () => {
    for (const domain of MATH_DOMAINS) {
      const steps = VERTICAL_PROGRESSION[domain];
      expect(steps.map(s => s.grade)).toEqual(['VI', 'VII', 'VIII', 'IX']);
      for (const step of steps) {
        expect(step.concepts.length).toBeGreaterThan(10);
        expect(step.outcomes.length).toBeGreaterThan(10);
      }
    }
  });

  it('has a label for every domain', () => {
    for (const domain of MATH_DOMAINS) {
      expect(DOMAIN_LABELS[domain]).toBeTruthy();
    }
  });

  it('maps arabic grades to the programme roman labels', () => {
    expect(romanForGrade('6')).toBe('VI');
    expect(romanForGrade('9')).toBe('IX');
    expect(romanForGrade('2год')).toBeNull();
  });

  it('returns what a grade covers in a domain', () => {
    expect(progressionStep('geometry', '8')?.concepts).toContain('Питагорова');
    expect(progressionStep('numbers', '7')?.concepts).toContain('Цели броеви');
  });

  it('returns null outside the VI–IX range it describes', () => {
    expect(progressionStep('numbers', '3')).toBeNull();
    expect(progressionStep('numbers', '1год')).toBeNull();
  });
});

describe('prerequisiteStep', () => {
  it('points one grade down within the same domain', () => {
    const step = prerequisiteStep('geometry', '8');
    expect(step?.grade).toBe('VII');
    expect(step?.concepts).toContain('триаголници');
  });

  it('has nothing below the first grade it describes', () => {
    expect(prerequisiteStep('numbers', '6')).toBeNull();
  });

  it('returns null for a grade outside the progression', () => {
    expect(prerequisiteStep('algebra', '1год')).toBeNull();
    expect(prerequisiteStep('algebra', '')).toBeNull();
  });

  it('chains all the way down', () => {
    expect(prerequisiteStep('algebra', '9')?.grade).toBe('VIII');
    expect(prerequisiteStep('algebra', '7')?.grade).toBe('VI');
  });
});

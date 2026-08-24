import { describe, it, expect } from 'vitest';
import { buildMasteryRollup, GradedEvidence } from './masteryRollup';
import {
  buildDomainSummary,
  buildMasteryCsv,
  csvField,
  masteryCsvFilename,
  toCsv,
} from './exportAnalytics';
import { CurriculumRef } from '../schema';

const headers = {
  domain: 'Област', code: 'Шифра', outcome: 'Исход', grade: 'Одделение',
  attempts: 'Обиди', average: 'Просек', worst: 'Најслаб',
};

const ref = (over: Partial<CurriculumRef> = {}): CurriculumRef => ({
  education_track: 'primary', grade: '8', topic_id: 't', topic_name: 'Геометрија',
  outcome_codes: ['МА.8.1.1'], source: 'ai', ...over,
});

const evidence = (score: number, over: Partial<GradedEvidence> = {}): GradedEvidence => ({
  studentId: 's1', score, curriculum_refs: [ref()], ...over,
});

describe('csvField', () => {
  it('quotes every field', () => {
    expect(csvField('текст')).toBe('"текст"');
    expect(csvField(42)).toBe('"42"');
  });

  it('escapes embedded quotes', () => {
    expect(csvField('ООУ „Блаже" Конески')).toBe('"ООУ „Блаже"" Конески"');
  });

  it('neutralises spreadsheet formula injection', () => {
    // Excel and Sheets execute these on open; the values include model output
    expect(csvField('=1+1')).toBe(`"'=1+1"`);
    expect(csvField('+CMD()')).toBe(`"'+CMD()"`);
    expect(csvField('-2+3')).toBe(`"'-2+3"`);
    expect(csvField('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
  });

  it('leaves ordinary text alone', () => {
    expect(csvField('Реши ја равенката')).toBe('"Реши ја равенката"');
  });

  it('handles null and undefined as empty', () => {
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });
});

describe('toCsv', () => {
  it('joins fields and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('"a","b"\r\n"c","d"');
  });

  it('handles an empty table', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('buildMasteryCsv', () => {
  const rollup = buildMasteryRollup([
    evidence(40),
    evidence(60),
    evidence(90, { curriculum_refs: [ref({ topic_name: 'Линеарни равенки', outcome_codes: ['МА.8.3.1'] })] }),
  ]);

  const csv = buildMasteryCsv(rollup, { headers, unclassifiedLabel: 'Некласифицирано' });
  const lines = csv.split('\r\n');

  it('starts with the supplied headers', () => {
    expect(lines[0]).toBe('"Област","Шифра","Исход","Одделение","Обиди","Просек","Најслаб"');
  });

  it('writes one row per outcome code', () => {
    expect(lines).toHaveLength(3);
  });

  it('orders rows weakest first, so the report reads as a to-do list', () => {
    expect(lines[1]).toContain('МА.8.1.1'); // average 50
    expect(lines[2]).toContain('МА.8.3.1'); // average 90
  });

  it('carries the domain label, attempts and both scores', () => {
    expect(lines[1]).toContain('Геометрија');
    expect(lines[1]).toContain('"2"');   // attempts
    expect(lines[1]).toContain('"50"');  // average
    expect(lines[1]).toContain('"40"');  // worst
  });

  it('labels codes that could not be placed in a domain', () => {
    const odd = buildMasteryRollup([
      evidence(50, { curriculum_refs: [ref({ topic_name: 'Повторување', outcome_codes: ['МА.8.9.1'] })] }),
    ]);
    expect(buildMasteryCsv(odd, { headers, unclassifiedLabel: 'Некласифицирано' })).toContain('Некласифицирано');
  });

  it('produces a header-only file when there is nothing to report', () => {
    const empty = buildMasteryCsv(buildMasteryRollup([]), { headers, unclassifiedLabel: '-' });
    expect(empty.split('\r\n')).toHaveLength(1);
  });
});

describe('masteryCsvFilename', () => {
  it('carries the export date', () => {
    expect(masteryCsvFilename('sovladanost', new Date('2026-08-23T10:00:00'))).toBe('sovladanost-2026-08-23.csv');
  });

  it('pads single-digit months and days', () => {
    expect(masteryCsvFilename('x', new Date('2026-01-05T10:00:00'))).toBe('x-2026-01-05.csv');
  });
});

describe('buildDomainSummary', () => {
  it('summarises each domain with its weakest code', () => {
    const rollup = buildMasteryRollup([
      evidence(20, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.1'] })] }),
      evidence(80, { curriculum_refs: [ref({ outcome_codes: ['МА.8.1.2'] })] }),
    ]);

    const [summary] = buildDomainSummary(rollup);
    expect(summary.label).toBe('Геометрија');
    expect(summary.attempts).toBe(2);
    expect(summary.weakestCode?.code).toBe('МА.8.1.1');
  });

  it('is empty with no classified evidence', () => {
    expect(buildDomainSummary(buildMasteryRollup([]))).toEqual([]);
  });
});

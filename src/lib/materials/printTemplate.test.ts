import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  EMPTY_TEMPLATE,
  isTemplateEmpty,
  loadPrintTemplate,
  normalizeTemplate,
  savePrintTemplate,
} from './printTemplate';

describe('normalizeTemplate', () => {
  it('trims and keeps the known fields', () => {
    expect(normalizeTemplate({ school: '  ООУ Блаже Конески ', teacher: 'Игор', subject: 'Математика', note: '' }))
      .toEqual({ school: 'ООУ Блаже Конески', teacher: 'Игор', subject: 'Математика', note: '' });
  });

  it('drops unknown and non-string fields', () => {
    expect(normalizeTemplate({ school: 42, evil: '<script>', teacher: null }))
      .toEqual(EMPTY_TEMPLATE);
  });

  it('caps absurdly long values', () => {
    expect(normalizeTemplate({ school: 'x'.repeat(500) }).school).toHaveLength(120);
  });

  it('handles anything that is not an object', () => {
    expect(normalizeTemplate(null)).toEqual(EMPTY_TEMPLATE);
    expect(normalizeTemplate('text')).toEqual(EMPTY_TEMPLATE);
  });
});

describe('isTemplateEmpty', () => {
  it('is true for a blank template', () => {
    expect(isTemplateEmpty(EMPTY_TEMPLATE)).toBe(true);
  });

  it('is false once any field is filled', () => {
    expect(isTemplateEmpty({ ...EMPTY_TEMPLATE, school: 'ООУ' })).toBe(false);
    expect(isTemplateEmpty({ ...EMPTY_TEMPLATE, note: 'x' })).toBe(false);
  });
});

describe('persistence', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a template', () => {
    savePrintTemplate({ school: 'ООУ', teacher: 'Игор', subject: 'Математика', note: '2026/27' });
    expect(loadPrintTemplate()).toEqual({ school: 'ООУ', teacher: 'Игор', subject: 'Математика', note: '2026/27' });
  });

  it('returns an empty template when nothing was stored', () => {
    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
  });

  it('survives corrupted stored data', () => {
    window.localStorage.setItem('mathdigitizer_print_template', '{not json');
    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
  });

  it('never lets a blocked storage break the export', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
    expect(() => savePrintTemplate({ ...EMPTY_TEMPLATE, school: 'ООУ' })).not.toThrow();
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ACCENT_PRESETS,
  EMPTY_TEMPLATE,
  MAX_LOGO_BYTES,
  PrintTemplate,
  buildDocumentReference,
  buildGradingScale,
  fitLogoSize,
  isTemplateEmpty,
  loadPrintTemplate,
  normalizeTemplate,
  resolveVariantLayout,
  sanitizeLogo,
  savePrintTemplate,
} from './printTemplate';
import { pointsToGrade } from '../exams/shuffle';

const template = (over: Partial<PrintTemplate> = {}): PrintTemplate => ({ ...EMPTY_TEMPLATE, ...over });

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

describe('normalizeTemplate', () => {
  it('trims and keeps the identity fields', () => {
    const result = normalizeTemplate({
      school: '  ООУ Блаже Конески ',
      municipality: ' Скопје ',
      schoolYear: '2026/2027',
      teacher: 'Игор',
      subject: 'Математика',
      grade: 'VII-б',
    });

    expect(result).toMatchObject({
      school: 'ООУ Блаже Конески',
      municipality: 'Скопје',
      schoolYear: '2026/2027',
      teacher: 'Игор',
      subject: 'Математика',
      grade: 'VII-б',
    });
  });

  it('carries an older four-field template forward with defaults', () => {
    const legacy = normalizeTemplate({ school: 'ООУ', teacher: 'Игор', subject: 'Математика', note: '2026/27' });

    expect(legacy.school).toBe('ООУ');
    expect(legacy.note).toBe('2026/27');
    expect(legacy.variant).toBe('official');
    expect(legacy.totalPoints).toBe(100);
    expect(legacy.logoDataUrl).toBe('');
  });

  it('drops unknown and non-string fields', () => {
    expect(normalizeTemplate({ school: 42, evil: '<script>', teacher: null }).school).toBe('');
  });

  it('caps absurdly long values', () => {
    expect(normalizeTemplate({ school: 'x'.repeat(500) }).school).toHaveLength(120);
  });

  it('rejects an invalid accent and variant', () => {
    expect(normalizeTemplate({ accent: 'javascript:alert(1)' }).accent).toBe(EMPTY_TEMPLATE.accent);
    expect(normalizeTemplate({ accent: '#1d4ed8' }).accent).toBe('#1d4ed8');
    expect(normalizeTemplate({ variant: 'fancy' }).variant).toBe('official');
    expect(normalizeTemplate({ variant: 'minimal' }).variant).toBe('minimal');
  });

  it('keeps totalPoints sane', () => {
    expect(normalizeTemplate({ totalPoints: 0 }).totalPoints).toBe(100);
    expect(normalizeTemplate({ totalPoints: -5 }).totalPoints).toBe(100);
    expect(normalizeTemplate({ totalPoints: 5000 }).totalPoints).toBe(1000);
    expect(normalizeTemplate({ totalPoints: 20.6 }).totalPoints).toBe(21);
  });

  it('preserves explicit false toggles', () => {
    expect(normalizeTemplate({ showPointsBox: false }).showPointsBox).toBe(false);
    expect(normalizeTemplate({ showPointsBox: 'nope' }).showPointsBox).toBe(true);
  });

  it('handles anything that is not an object', () => {
    expect(normalizeTemplate(null)).toEqual(EMPTY_TEMPLATE);
    expect(normalizeTemplate('text')).toEqual(EMPTY_TEMPLATE);
  });
});

describe('sanitizeLogo', () => {
  it('accepts an inline image data URL', () => {
    expect(sanitizeLogo(PNG_DATA_URL)).toBe(PNG_DATA_URL);
    expect(sanitizeLogo('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeTruthy();
  });

  it('rejects a remote URL, a script URL and a non-image data URL', () => {
    expect(sanitizeLogo('https://example.com/logo.png')).toBe('');
    expect(sanitizeLogo('javascript:alert(1)')).toBe('');
    expect(sanitizeLogo('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
  });

  it('rejects a logo that would fill the storage quota', () => {
    expect(sanitizeLogo(`data:image/png;base64,${'A'.repeat(MAX_LOGO_BYTES)}`)).toBe('');
  });

  it('rejects non-strings', () => {
    expect(sanitizeLogo(null)).toBe('');
    expect(sanitizeLogo(42)).toBe('');
  });
});

describe('isTemplateEmpty', () => {
  it('is true for a blank template', () => {
    expect(isTemplateEmpty(EMPTY_TEMPLATE)).toBe(true);
  });

  it('is false once any identity field is filled', () => {
    expect(isTemplateEmpty(template({ school: 'ООУ' }))).toBe(false);
    expect(isTemplateEmpty(template({ grade: 'VII' }))).toBe(false);
    expect(isTemplateEmpty(template({ logoDataUrl: PNG_DATA_URL }))).toBe(false);
  });

  it('ignores layout-only settings', () => {
    expect(isTemplateEmpty(template({ variant: 'minimal', accent: ACCENT_PRESETS[2] }))).toBe(true);
  });
});

describe('resolveVariantLayout', () => {
  it('official shows the full document furniture', () => {
    const layout = resolveVariantLayout(template({ school: 'ООУ', municipality: 'Скопје', logoDataUrl: PNG_DATA_URL }));
    expect(layout).toMatchObject({ showLogo: true, showMunicipality: true, showMetaRow: true, showPointsBox: true });
  });

  it('minimal strips it back to the title', () => {
    const layout = resolveVariantLayout(template({ variant: 'minimal', logoDataUrl: PNG_DATA_URL, municipality: 'Скопје' }));
    expect(layout).toMatchObject({
      showLogo: false,
      showMunicipality: false,
      showMetaRow: false,
      showStudentFields: false,
      showPointsBox: false,
    });
  });

  it('compact keeps identity and marking, but as one dense line', () => {
    const layout = resolveVariantLayout(template({
      variant: 'compact', showGradingScale: true, school: 'ООУ', municipality: 'Скопје', logoDataUrl: PNG_DATA_URL,
    }));

    expect(layout.dense).toBe(true);
    expect(layout.showLogo).toBe(false);
    expect(layout.showMunicipality).toBe(false);
    expect(layout.showGradingScale).toBe(false);
    // Still a working sheet: the student fills it in and the teacher marks it
    expect(layout.showStudentFields).toBe(true);
    expect(layout.showPointsBox).toBe(true);
  });

  it('official is the roomy layout, compact and minimal are dense', () => {
    expect(resolveVariantLayout(template({ variant: 'official' })).dense).toBe(false);
    expect(resolveVariantLayout(template({ variant: 'compact' })).dense).toBe(true);
    expect(resolveVariantLayout(template({ variant: 'minimal' })).dense).toBe(true);
  });

  it('never shows a logo that was not uploaded', () => {
    expect(resolveVariantLayout(template()).showLogo).toBe(false);
  });

  it('respects the explicit toggles', () => {
    expect(resolveVariantLayout(template({ showPointsBox: false })).showPointsBox).toBe(false);
    expect(resolveVariantLayout(template({ showFooter: false })).showFooter).toBe(false);
  });
});

describe('buildGradingScale', () => {
  it('covers every grade, ascending', () => {
    const scale = buildGradingScale(100);
    expect(scale.map(b => b.grade)).toEqual([1, 2, 3, 4, 5]);
  });

  it('agrees with the grading used when marking', () => {
    // Every band's own bounds must map back to that grade
    for (const band of buildGradingScale(100)) {
      expect(pointsToGrade(band.minPoints, 100)).toBe(band.grade);
      expect(pointsToGrade(band.maxPoints, 100)).toBe(band.grade);
    }
  });

  it('holds for a non-100 point total', () => {
    for (const band of buildGradingScale(20)) {
      expect(pointsToGrade(band.minPoints, 20)).toBe(band.grade);
      expect(pointsToGrade(band.maxPoints, 20)).toBe(band.grade);
    }
  });

  it('leaves no gap between bands and tops out at the total', () => {
    const scale = buildGradingScale(50);
    for (let i = 1; i < scale.length; i++) {
      expect(scale[i].minPoints).toBe(scale[i - 1].maxPoints + 1);
    }
    expect(scale[scale.length - 1].maxPoints).toBe(50);
  });

  it('falls back to a sane total for garbage input', () => {
    expect(buildGradingScale(0)[4].maxPoints).toBe(100);
  });
});

describe('buildDocumentReference', () => {
  const day = new Date('2026-08-23T10:00:00.000Z');

  it('is deterministic for the same title and day', () => {
    expect(buildDocumentReference('Тест: Равенки', day)).toBe(buildDocumentReference('Тест: Равенки', day));
  });

  it('differs between documents', () => {
    expect(buildDocumentReference('Тест А', day)).not.toBe(buildDocumentReference('Тест Б', day));
  });

  it('carries the issue date and a short suffix', () => {
    expect(buildDocumentReference('Тест', day)).toMatch(/^MD-2026(08|09)\d{2}-[A-Z0-9]{1,4}$/);
  });

  it('handles an empty title', () => {
    expect(buildDocumentReference('', day)).toMatch(/^MD-/);
  });
});

describe('fitLogoSize', () => {
  it('scales a large logo down inside the box, keeping the ratio', () => {
    expect(fitLogoSize({ width: 2000, height: 1000 })).toEqual({ width: 320, height: 160 });
  });

  it('never scales a small logo up', () => {
    expect(fitLogoSize({ width: 64, height: 64 })).toEqual({ width: 64, height: 64 });
  });

  it('handles a tall logo', () => {
    expect(fitLogoSize({ width: 500, height: 2000 })).toEqual({ width: 80, height: 320 });
  });

  it('returns nothing for a degenerate image', () => {
    expect(fitLogoSize({ width: 0, height: 100 })).toEqual({ width: 0, height: 0 });
  });
});

describe('persistence', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a full template', () => {
    const full = template({ school: 'ООУ', teacher: 'Игор', variant: 'compact', totalPoints: 40, showFooter: false });
    savePrintTemplate(full);
    expect(loadPrintTemplate()).toEqual(full);
  });

  it('returns an empty template when nothing was stored', () => {
    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
  });

  it('survives corrupted stored data', () => {
    window.localStorage.setItem('mathdigitizer_print_template', '{not json');
    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
  });

  it('never lets blocked storage break the export', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

    expect(loadPrintTemplate()).toEqual(EMPTY_TEMPLATE);
    expect(() => savePrintTemplate(template({ school: 'ООУ' }))).not.toThrow();
  });
});

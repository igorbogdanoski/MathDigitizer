import { describe, it, expect } from 'vitest';
import { getRouteSeo } from './seo';

describe('getRouteSeo', () => {
  it('returns the home page metadata', () => {
    const seo = getRouteSeo('/');

    expect(seo.title).toContain('MathDigitizer Pro');
    expect(seo.canonical).toBe('/');
    expect(seo.noindex).toBeUndefined();
    expect(Array.isArray(seo.structuredData)).toBe(true);
  });

  it('marks live routes as noindex', () => {
    const seo = getRouteSeo('/live/ABCD123/host');

    expect(seo.title).toBe('Live Host');
    expect(seo.noindex).toBe(true);
    expect(seo.canonical).toBe('/live-board');
  });

  it('returns route specific metadata for classrooms detail pages', () => {
    const seo = getRouteSeo('/classrooms/123');

    expect(seo.title).toBe('Училници');
    expect(seo.canonical).toBe('/classrooms');
  });

  it('returns pricing offer catalog structured data', () => {
    const seo = getRouteSeo('/pricing');
    const blocks = Array.isArray(seo.structuredData) ? seo.structuredData : [];
    const hasOfferCatalog = blocks.some((item: any) => item['@type'] === 'OfferCatalog');

    expect(hasOfferCatalog).toBe(true);
  });

  it('marks all protected app routes as noindex', () => {
    const protectedRoutes = [
      '/extract', '/smart-ocr', '/library', '/dashboard', '/analytics',
      '/ai-pedagogy', '/curriculum', '/classrooms', '/classrooms/abc',
      '/students/uid123', '/live-board', '/school-inquiries',
      '/exams-grading', '/smart-grader', '/factory', '/mass-factory',
      '/todo', '/flashcards', '/adaptive-test',
    ];

    for (const route of protectedRoutes) {
      const seo = getRouteSeo(route);
      expect(seo.noindex, `Expected ${route} to be noindex`).toBe(true);
    }
  });

  it('keeps public marketing routes indexable', () => {
    const publicRoutes = ['/', '/pricing'];

    for (const route of publicRoutes) {
      const seo = getRouteSeo(route);
      expect(seo.noindex, `Expected ${route} to be indexable`).toBeFalsy();
    }
  });

  it('resolves missing routes to a structuredData array without throwing', () => {
    const seo = getRouteSeo('/some-unknown-path');

    expect(Array.isArray(seo.structuredData)).toBe(true);
  });
});
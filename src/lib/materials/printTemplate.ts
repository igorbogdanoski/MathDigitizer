/**
 * Reusable print header for exported materials
 * (EXPERT_LEVEL_MASTER_PLAN, 6.1 — templates).
 *
 * A teacher types their school and name once; every worksheet, test and
 * homework sheet they export then carries it. Stored per browser, because it is
 * a personal convenience rather than shared data — and every access is guarded,
 * since storage can throw in a private window.
 */

export interface PrintTemplate {
  school: string;
  teacher: string;
  subject: string;
  /** Optional free-text line under the school (department, school year…). */
  note: string;
}

export const EMPTY_TEMPLATE: PrintTemplate = { school: '', teacher: '', subject: '', note: '' };

const STORAGE_KEY = 'mathdigitizer_print_template';

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, 120) : '';

/** Normalises anything read from storage into a usable template. */
export function normalizeTemplate(raw: unknown): PrintTemplate {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_TEMPLATE };
  const source = raw as Record<string, unknown>;
  return {
    school: clean(source.school),
    teacher: clean(source.teacher),
    subject: clean(source.subject),
    note: clean(source.note),
  };
}

/** True when the template has nothing to print. */
export function isTemplateEmpty(template: PrintTemplate): boolean {
  return !template.school && !template.teacher && !template.subject && !template.note;
}

export function loadPrintTemplate(): PrintTemplate {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeTemplate(JSON.parse(stored)) : { ...EMPTY_TEMPLATE };
  } catch {
    // Private windows and blocked site data both throw here.
    return { ...EMPTY_TEMPLATE };
  }
}

export function savePrintTemplate(template: PrintTemplate): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeTemplate(template)));
  } catch {
    // Losing the convenience is acceptable; failing the export is not.
  }
}

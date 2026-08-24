/**
 * Branded document template for printed/exported materials
 * (EXPERT_LEVEL_MASTER_PLAN, 6.1 — templates).
 *
 * A Macedonian school document is a formal artefact: it carries the school's
 * identity, the subject and class, the teacher, the school year, space for the
 * student's details, and a points/grade box tied to the official 1–5 scale.
 * The teacher fills this in once; every worksheet, test and homework sheet they
 * export then looks like it came from their school rather than from a tool.
 *
 * Everything here is pure — normalisation, variants, the grading legend and the
 * document reference — so the rendering component stays thin and this stays
 * testable.
 */
import { GRADE_THRESHOLDS } from '../exams/shuffle';

/** How much document furniture the header shows. */
export type TemplateVariant = 'official' | 'compact' | 'minimal';

export interface PrintTemplate {
  // ── School identity ──
  /** Data URL of the school logo; empty when none was uploaded. */
  logoDataUrl: string;
  school: string;
  /** Municipality / place, printed under the school name. */
  municipality: string;
  schoolYear: string;

  // ── Document identity ──
  subject: string;
  /** Grade or class, e.g. "VII-б" or "2год-миг". */
  grade: string;
  teacher: string;

  // ── Layout ──
  variant: TemplateVariant;
  /** Print-safe accent used for rules and the points box. */
  accent: string;
  showStudentFields: boolean;
  showPointsBox: boolean;
  showGradingScale: boolean;
  showFooter: boolean;

  /** Points available; drives the grading legend. */
  totalPoints: number;

  /** Legacy free-text line, kept so older stored templates do not lose it. */
  note: string;
}

/** Accents that stay legible in greyscale, which is how most schools print. */
export const ACCENT_PRESETS = ['#1e293b', '#1d4ed8', '#047857', '#b91c1c', '#6d28d9'] as const;

export const EMPTY_TEMPLATE: PrintTemplate = {
  logoDataUrl: '',
  school: '',
  municipality: '',
  schoolYear: '',
  subject: '',
  grade: '',
  teacher: '',
  variant: 'official',
  accent: ACCENT_PRESETS[0],
  showStudentFields: true,
  showPointsBox: true,
  showGradingScale: false,
  showFooter: true,
  totalPoints: 100,
  note: '',
};

const STORAGE_KEY = 'mathdigitizer_print_template';

/** Data URLs are capped so a large logo cannot fill the storage quota. */
export const MAX_LOGO_BYTES = 200_000;

const clean = (value: unknown, max = 120): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Only accepts an inline image data URL — never a remote or script URL. */
export function sanitizeLogo(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(value)) return '';
  return value.length > MAX_LOGO_BYTES ? '' : value;
}

function normalizeAccent(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : EMPTY_TEMPLATE.accent;
}

function normalizeVariant(value: unknown): TemplateVariant {
  return value === 'compact' || value === 'minimal' || value === 'official' ? value : 'official';
}

function normalizePoints(value: unknown): number {
  const points = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(points) || points <= 0) return EMPTY_TEMPLATE.totalPoints;
  return Math.min(1000, Math.round(points));
}

/**
 * Normalises anything read from storage into a usable template.
 * Older templates stored only school/teacher/subject/note; those fields are
 * carried over and the rest fall back to defaults.
 */
export function normalizeTemplate(raw: unknown): PrintTemplate {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_TEMPLATE };
  const s = raw as Record<string, unknown>;

  return {
    logoDataUrl: sanitizeLogo(s.logoDataUrl),
    school: clean(s.school),
    municipality: clean(s.municipality, 80),
    schoolYear: clean(s.schoolYear, 20),
    subject: clean(s.subject, 80),
    grade: clean(s.grade, 40),
    teacher: clean(s.teacher),
    variant: normalizeVariant(s.variant),
    accent: normalizeAccent(s.accent),
    showStudentFields: bool(s.showStudentFields, EMPTY_TEMPLATE.showStudentFields),
    showPointsBox: bool(s.showPointsBox, EMPTY_TEMPLATE.showPointsBox),
    showGradingScale: bool(s.showGradingScale, EMPTY_TEMPLATE.showGradingScale),
    showFooter: bool(s.showFooter, EMPTY_TEMPLATE.showFooter),
    totalPoints: normalizePoints(s.totalPoints),
    note: clean(s.note, 200),
  };
}

/** True when the template carries no identity worth printing. */
export function isTemplateEmpty(template: PrintTemplate): boolean {
  return (
    !template.school &&
    !template.teacher &&
    !template.subject &&
    !template.grade &&
    !template.schoolYear &&
    !template.municipality &&
    !template.note &&
    !template.logoDataUrl
  );
}

export interface VariantLayout {
  showLogo: boolean;
  showMunicipality: boolean;
  showMetaRow: boolean;
  showStudentFields: boolean;
  showPointsBox: boolean;
  showGradingScale: boolean;
  showFooter: boolean;
  /** Thickness of the rule under the header, in px. */
  ruleWidth: number;
  /**
   * Identity as one inline line rather than a logo block, and student fields
   * on a single row — the difference that makes 'compact' actually compact.
   */
  dense: boolean;
}

/**
 * What a variant actually renders.
 *
 * `official` is the full formal sheet; `compact` drops the decorative parts but
 * keeps identity and marking; `minimal` is just a title line, for handouts that
 * should not look like an exam.
 */
export function resolveVariantLayout(template: PrintTemplate): VariantLayout {
  const base = {
    showLogo: Boolean(template.logoDataUrl),
    showMunicipality: Boolean(template.municipality),
    showMetaRow: true,
    showStudentFields: template.showStudentFields,
    showPointsBox: template.showPointsBox,
    showGradingScale: template.showGradingScale,
    showFooter: template.showFooter,
    ruleWidth: 2,
    dense: false,
  };

  if (template.variant === 'compact') {
    // One identity line, one row of student fields, no legend — fits a short
    // worksheet on a single sheet.
    return {
      ...base,
      showLogo: false,
      showMunicipality: false,
      showGradingScale: false,
      ruleWidth: 1,
      dense: true,
    };
  }

  if (template.variant === 'minimal') {
    return {
      ...base,
      showLogo: false,
      showMunicipality: false,
      showMetaRow: false,
      showStudentFields: false,
      showPointsBox: false,
      showGradingScale: false,
      ruleWidth: 1,
      dense: true,
    };
  }

  return base;
}

export interface GradeBand {
  grade: 1 | 2 | 3 | 4 | 5;
  minPoints: number;
  maxPoints: number;
  label: string;
}

/**
 * The official 1–5 scale expressed in points, so the printed legend and the
 * grading in the teacher dashboard cannot drift apart — both derive from
 * GRADE_THRESHOLDS.
 */
export function buildGradingScale(totalPoints: number): GradeBand[] {
  const total = normalizePoints(totalPoints);

  // Thresholds run high → low; each band ends just below the next one up.
  return GRADE_THRESHOLDS.map((threshold, index) => {
    const minPoints = Math.ceil((threshold.min / 100) * total);
    const above = GRADE_THRESHOLDS[index - 1];
    const maxPoints = above ? Math.ceil((above.min / 100) * total) - 1 : total;

    return {
      grade: threshold.grade,
      minPoints,
      maxPoints: Math.max(minPoints, maxPoints),
      label: `${minPoints}–${Math.max(minPoints, maxPoints)}`,
    };
  }).reverse(); // print ascending, 1 → 5
}

/**
 * Short, stable reference printed in the footer, so a teacher can tell two
 * versions of the same worksheet apart. Deterministic for the same inputs.
 */
export function buildDocumentReference(title: string, issuedAt: Date = new Date()): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const stamp = [
    issuedAt.getFullYear(),
    String(issuedAt.getMonth() + 1).padStart(2, '0'),
    String(issuedAt.getDate()).padStart(2, '0'),
  ].join('');

  return `MD-${stamp}-${(hash >>> 0).toString(36).toUpperCase().slice(0, 4)}`;
}

/** Fits a logo inside a print-friendly box, preserving the aspect ratio. */
export function fitLogoSize(
  natural: { width: number; height: number },
  box = { width: 320, height: 320 }
): { width: number; height: number } {
  const { width, height } = natural;
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };

  const scale = Math.min(box.width / width, box.height / height, 1);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScaleType = 'linear' | 'log';
export type Step = 'upload' | 'setup' | 'calibrate' | 'digitize' | 'analyze' | 'export';
export type DigitizeMode = 'add' | 'delete';

export interface AxisConfig {
  label: string;
  min: number;
  max: number;
  scale: ScaleType;
}

export interface CalibPoint {
  pixel: { x: number; y: number };
  real: { x: number; y: number };
}

export interface DataPoint {
  id: string;
  px: number;
  py: number;
  rx: number;
  ry: number;
}

export interface Dataset {
  name: string;
  color: string;
  points: DataPoint[];
}

export interface MousePos {
  imgX: number;
  imgY: number;
  clientX: number;
  clientY: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DATASET_COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

export const DOK_LABELS: Record<number, string> = { 1: 'Recall', 2: 'Skill', 3: 'Strategic', 4: 'Extended' };
export const DOK_COLORS: Record<number, string> = { 1: 'bg-emerald-100 text-emerald-700', 2: 'bg-blue-100 text-blue-700', 3: 'bg-amber-100 text-amber-700', 4: 'bg-red-100 text-red-700' };
export const BLOOM_MK: Record<string, string> = {
  remember: 'Памети', understand: 'Разбери', apply: 'Примени',
  analyze: 'Анализирај', evaluate: 'Оценувај', create: 'Создади',
};

export const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Слика' },
  { id: 'setup', label: 'Оски' },
  { id: 'calibrate', label: 'Калиб.' },
  { id: 'digitize', label: 'Точки' },
  { id: 'analyze', label: 'AI' },
  { id: 'export', label: 'Извоз' },
];

// ─── Coordinate transform ──────────────────────────────────────────────────────

export function pixelToReal(
  px: number, py: number,
  p1: CalibPoint, p2: CalibPoint,
  xScale: ScaleType, yScale: ScaleType,
): { x: number; y: number } {
  const dx = p2.pixel.x - p1.pixel.x;
  const dy = p2.pixel.y - p1.pixel.y;

  let rx: number;
  if (xScale === 'log') {
    const logR1 = Math.log10(p1.real.x);
    const logR2 = Math.log10(p2.real.x);
    rx = Math.pow(10, logR1 + (px - p1.pixel.x) / dx * (logR2 - logR1));
  } else {
    rx = p1.real.x + (px - p1.pixel.x) / dx * (p2.real.x - p1.real.x);
  }

  let ry: number;
  if (yScale === 'log') {
    const logR1 = Math.log10(p1.real.y);
    const logR2 = Math.log10(p2.real.y);
    ry = Math.pow(10, logR1 + (py - p1.pixel.y) / dy * (logR2 - logR1));
  } else {
    ry = p1.real.y + (py - p1.pixel.y) / dy * (p2.real.y - p1.real.y);
  }

  return { x: Math.round(rx * 10000) / 10000, y: Math.round(ry * 10000) / 10000 };
}

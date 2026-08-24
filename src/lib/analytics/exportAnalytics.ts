/**
 * Analytics export (EXPERT_LEVEL_MASTER_PLAN, 7.4).
 *
 * A teacher has to report to a head of department or to БРО, and screenshots of
 * a dashboard are not a report. This produces a CSV of the per-code mastery
 * rollup — the numbers the panel shows, in a form a spreadsheet can open.
 *
 * The CSV is built purely so it can be tested without a browser; the download
 * side is a two-line caller.
 */
import { MasteryRollup, CodeMastery } from './masteryRollup';
import { DOMAIN_LABELS } from './curriculumTaxonomy';

/**
 * Escapes one CSV field.
 *
 * Also neutralises spreadsheet formula injection: a value starting with =, +,
 * - or @ is executed by Excel and Sheets when the file is opened, and these
 * values include free text that came from a model.
 */
export function csvField(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(csvField).join(',')).join('\r\n');
}

export interface MasteryCsvOptions {
  /** Column headers, so the caller supplies the UI language. */
  headers: {
    domain: string;
    code: string;
    outcome: string;
    grade: string;
    attempts: string;
    average: string;
    worst: string;
  };
  /** Label for codes that could not be placed in a domain. */
  unclassifiedLabel: string;
}

/** One row per outcome code, ordered weakest first — the actionable order. */
export function buildMasteryCsv(rollup: MasteryRollup, options: MasteryCsvOptions): string {
  const { headers, unclassifiedLabel } = options;

  const rows: unknown[][] = [[
    headers.domain,
    headers.code,
    headers.outcome,
    headers.grade,
    headers.attempts,
    headers.average,
    headers.worst,
  ]];

  for (const code of rollup.codes) {
    rows.push([
      code.domain ? DOMAIN_LABELS[code.domain] : unclassifiedLabel,
      code.code,
      code.label,
      code.grade ?? '',
      code.attempts,
      code.averageScore,
      code.worstScore,
    ]);
  }

  return toCsv(rows);
}

/** Filename carrying the export date, so successive exports do not collide. */
export function masteryCsvFilename(prefix = 'sovladanost', now: Date = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefix}-${stamp}.csv`;
}

/**
 * Triggers the download. A BOM is prepended because Excel on Windows otherwise
 * reads the Cyrillic as mojibake.
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/** Flat summary rows for a whole-class export. */
export function buildDomainSummary(rollup: MasteryRollup): Array<{
  label: string;
  attempts: number;
  averageScore: number;
  weakestCode: CodeMastery | null;
}> {
  return rollup.domains.map(domain => ({
    label: domain.label,
    attempts: domain.attempts,
    averageScore: domain.averageScore,
    weakestCode: domain.codes[0] ?? null,
  }));
}

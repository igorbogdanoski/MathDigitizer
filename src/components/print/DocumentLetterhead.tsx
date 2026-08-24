import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PrintTemplate,
  buildDocumentReference,
  buildGradingScale,
  isTemplateEmpty,
  resolveVariantLayout,
} from '../../lib/materials/printTemplate';

interface DocumentLetterheadProps {
  template: PrintTemplate;
  /** Document title, printed as the main heading. */
  title: string;
  /** Localised document kind ("Работен лист", "Тест"…). */
  kind?: string;
  issuedAt?: Date;
}

/**
 * The branded letterhead of a printed material.
 *
 * Laid out the way a formal school document is: the school's identity on the
 * left, document identity on the right, then the title, then the fields the
 * student fills in and the box the teacher marks in. Everything is print-safe —
 * black text, hairline rules, no background washes that eat toner.
 */
export const DocumentLetterhead: React.FC<DocumentLetterheadProps> = ({
  template,
  title,
  kind,
  issuedAt,
}) => {
  const { t } = useTranslation('materialsFactory');
  const layout = resolveVariantLayout(template);
  const scale = layout.showGradingScale ? buildGradingScale(template.totalPoints) : [];

  const metaEntries = [
    template.subject && { label: t('letterhead.subject'), value: template.subject },
    template.grade && { label: t('letterhead.grade'), value: template.grade },
    template.schoolYear && { label: t('letterhead.schoolYear'), value: template.schoolYear },
    template.teacher && { label: t('letterhead.teacher'), value: template.teacher },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <header data-pdf-block data-letterhead className="mb-8 text-slate-900">
      {/* Dense identity: everything on one line */}
      {layout.dense && !isTemplateEmpty(template) && (
        <p className="pb-2 text-[11px] uppercase tracking-widest text-slate-600">
          <span className="font-black text-slate-900">{template.school}</span>
          {[template.subject, template.grade, template.schoolYear, template.teacher]
            .filter(Boolean)
            .map(value => <span key={value}> · {value}</span>)}
        </p>
      )}

      {/* School identity + document identity */}
      {!layout.dense && !isTemplateEmpty(template) && (
        <div className="flex items-start justify-between gap-6 pb-3">
          <div className="flex items-start gap-3 min-w-0">
            {layout.showLogo && (
              // Decorative: the school name next to it carries the meaning.
              <img
                src={template.logoDataUrl}
                alt=""
                className="h-14 w-14 object-contain shrink-0"
              />
            )}
            <div className="min-w-0">
              {template.school && (
                <p className="font-black uppercase tracking-wide leading-tight text-[15px]">
                  {template.school}
                </p>
              )}
              {layout.showMunicipality && (
                <p className="text-[11px] uppercase tracking-widest text-slate-600 mt-0.5">
                  {template.municipality}
                </p>
              )}
              {template.note && (
                <p className="text-[11px] text-slate-600 mt-1">{template.note}</p>
              )}
            </div>
          </div>

          {layout.showMetaRow && metaEntries.length > 0 && (
            <dl className="text-right text-[11px] leading-relaxed shrink-0">
              {metaEntries.map(entry => (
                <div key={entry.label} className="whitespace-nowrap">
                  <dt className="inline uppercase tracking-widest text-slate-500">{entry.label}: </dt>
                  <dd className="inline font-bold">{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Accent rule separating identity from the document itself */}
      <div
        className="w-full"
        style={{ borderTopWidth: layout.ruleWidth, borderTopStyle: 'solid', borderTopColor: template.accent }}
        aria-hidden="true"
      />

      {/* Title block */}
      <div className="pt-4 pb-3">
        {kind && (
          <p
            className="text-[11px] font-black uppercase tracking-[0.2em]"
            style={{ color: template.accent }}
          >
            {kind}
          </p>
        )}
        <h1 className="text-2xl font-black leading-tight mt-1">{title}</h1>
      </div>

      {/* Student fields and the marking box */}
      {(layout.showStudentFields || layout.showPointsBox) && (
        <div className="flex items-start gap-6 border-t border-slate-300 pt-4">
          {layout.showStudentFields && (
            <div className={`grid gap-x-8 gap-y-3 flex-1 text-[12px] ${layout.dense ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {[
                t('letterhead.studentName'),
                t('letterhead.studentSurname'),
                t('letterhead.studentClass'),
                t('letterhead.date'),
              ].map(label => (
                <div key={label} className="flex items-end gap-2">
                  <span className="text-slate-600 whitespace-nowrap">{label}:</span>
                  <span className="flex-1 min-w-[3.5rem] border-b border-dotted border-slate-400 h-4" />
                </div>
              ))}
            </div>
          )}

          {layout.showPointsBox && (
            <div
              className="shrink-0 w-44 border px-3 py-2 text-[11px]"
              style={{ borderColor: template.accent }}
            >
              <p
                className="font-black uppercase tracking-widest text-[10px] pb-1 mb-2 border-b"
                style={{ color: template.accent, borderColor: template.accent }}
              >
                {t('letterhead.assessment')}
              </p>
              <div className="flex justify-between items-end mb-2">
                <span className="text-slate-600">{t('letterhead.points')}</span>
                <span className="font-bold">
                  <span className="inline-block w-10 border-b border-slate-400" /> / {template.totalPoints}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-slate-600">{t('letterhead.gradeLabel')}</span>
                <span className="inline-block w-10 border-b border-slate-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grading legend, derived from the same 1–5 thresholds used when marking */}
      {scale.length > 0 && (
        <table className="mt-4 w-full border-collapse text-[10px]">
          <caption className="text-left uppercase tracking-widest text-slate-500 pb-1">
            {t('letterhead.gradingScale')}
          </caption>
          <thead>
            <tr>
              {scale.map(band => (
                <th key={band.grade} className="border border-slate-300 px-2 py-1 font-bold">
                  {band.grade}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {scale.map(band => (
                <td key={band.grade} className="border border-slate-300 px-2 py-1 text-center text-slate-700">
                  {band.label}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
    </header>
  );
};

interface DocumentFooterProps {
  template: PrintTemplate;
  title: string;
  issuedAt?: Date;
}

/**
 * Printed footer. Page numbers come from CSS counters (see index.css), because
 * only the print engine knows how many pages the document ends up being.
 */
export const DocumentFooter: React.FC<DocumentFooterProps> = ({ template, title, issuedAt }) => {
  const { t } = useTranslation('materialsFactory');
  if (!resolveVariantLayout(template).showFooter) return null;

  const reference = buildDocumentReference(title, issuedAt);

  return (
    <footer
      data-pdf-block
      className="mt-10 pt-2 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500"
    >
      <span className="truncate max-w-[60%]">
        {[template.school, template.subject].filter(Boolean).join(' • ') || t('letterhead.generatedBy')}
      </span>
      <span className="font-mono">{reference}</span>
    </footer>
  );
};

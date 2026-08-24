import React from 'react';
import { DocumentFooter, DocumentLetterhead } from '../print/DocumentLetterhead';
import { EMPTY_TEMPLATE, PrintTemplate, TemplateVariant } from '../../lib/materials/printTemplate';

/**
 * DEV-only visual harness for the branded print template.
 *
 * The real preview lives behind the Pro gate, so this renders the letterhead on
 * an A4-width sheet for every variant — the way a design deliverable should be
 * checked: by looking at it, at print width, not only by asserting on the DOM.
 */
const SAMPLE: PrintTemplate = {
  ...EMPTY_TEMPLATE,
  school: 'ООУ „Блаже Конески"',
  municipality: 'Општина Аеродром, Скопје',
  schoolYear: '2026/2027',
  subject: 'Математика',
  grade: 'VII-б',
  teacher: 'Игор Богданоски',
  showGradingScale: true,
  totalPoints: 20,
  // A tiny inline crest, so the layout can be judged with a logo present.
  logoDataUrl:
    'data:image/svg+xml;base64,' +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="30" fill="none" stroke="#1e293b" stroke-width="3"/>' +
      '<path d="M20 42 L32 20 L44 42 Z" fill="none" stroke="#1e293b" stroke-width="3"/>' +
      '</svg>'
    ),
};

const VARIANTS: Array<{ variant: TemplateVariant; kind: string }> = [
  { variant: 'official', kind: 'Тест' },
  { variant: 'compact', kind: 'Работен лист' },
  { variant: 'minimal', kind: 'Домашна работа' },
];

export const LetterheadProbe: React.FC = () => (
  <div style={{ background: '#e2e8f0', padding: 24, minHeight: '100vh' }}>
    <h1 style={{ fontFamily: 'system-ui', fontSize: 18, marginBottom: 16 }}>Letterhead Probe</h1>

    {VARIANTS.map(({ variant, kind }) => (
      <section
        key={variant}
        data-testid={`sheet-${variant}`}
        style={{
          width: '210mm',
          minHeight: '120mm',
          margin: '0 auto 24px',
          padding: '15mm',
          background: '#fff',
          boxShadow: '0 10px 30px rgba(15,23,42,0.15)',
        }}
      >
        <DocumentLetterhead
          template={{ ...SAMPLE, variant }}
          title="Контролна задача: Линеарни равенки"
          kind={kind}
          issuedAt={new Date('2026-08-23T10:00:00Z')}
        />

        <div style={{ fontSize: 13, lineHeight: 1.7, color: '#0f172a' }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>1. Реши ја равенката 2x + 3 = 11.</p>
          <p style={{ color: '#64748b' }}>_________________________________________________</p>
        </div>

        <DocumentFooter
          template={{ ...SAMPLE, variant }}
          title="Контролна задача: Линеарни равенки"
          issuedAt={new Date('2026-08-23T10:00:00Z')}
        />
      </section>
    ))}
  </div>
);

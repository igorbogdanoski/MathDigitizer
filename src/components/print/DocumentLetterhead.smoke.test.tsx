import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentLetterhead, DocumentFooter } from './DocumentLetterhead';
import { EMPTY_TEMPLATE, PrintTemplate } from '../../lib/materials/printTemplate';

const template = (over: Partial<PrintTemplate> = {}): PrintTemplate => ({
  ...EMPTY_TEMPLATE,
  school: 'ООУ „Блаже Конески"',
  municipality: 'Скопје',
  schoolYear: '2026/2027',
  subject: 'Математика',
  grade: 'VII-б',
  teacher: 'Игор Богданоски',
  ...over,
});

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

// The test environment resolves i18n to English; assert on either language so
// the tests describe behaviour rather than one locale's wording.
const ASSESSMENT = /Оценување|Assessment|Vlerësimi/;
const STUDENT_NAME = /Име|Name|Emri/;
const STUDENT_SURNAME = /Презиме|Surname|Mbiemri/;
const GRADING_SCALE = /Скала на оценување|Grading scale|Shkalla e vlerësimit/;

describe('DocumentLetterhead', () => {
  it('prints the school identity and the document meta', () => {
    render(<DocumentLetterhead template={template()} title="Контролна задача" kind="Тест" />);

    expect(screen.getByText('ООУ „Блаже Конески"')).toBeInTheDocument();
    expect(screen.getByText('Скопје')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Контролна задача' })).toBeInTheDocument();
    expect(screen.getByText('Тест')).toBeInTheDocument();
    expect(screen.getByText('Математика')).toBeInTheDocument();
    expect(screen.getByText('VII-б')).toBeInTheDocument();
  });

  it('renders the logo as decorative, since the school name carries the meaning', () => {
    const { container } = render(<DocumentLetterhead template={template({ logoDataUrl: LOGO })} title="Т" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('alt', '');
  });

  it('shows the student fields and the marking box by default', () => {
    const { container } = render(<DocumentLetterhead template={template()} title="Т" />);
    expect(container.textContent).toMatch(STUDENT_NAME);
    expect(container.textContent).toMatch(STUDENT_SURNAME);
    expect(container.textContent).toMatch(ASSESSMENT);
    expect(container.textContent).toContain('/ 100');
  });

  it('strips the furniture in the minimal variant', () => {
    const { container } = render(
      <DocumentLetterhead template={template({ variant: 'minimal', logoDataUrl: LOGO })} title="Т" />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).not.toMatch(ASSESSMENT);
    expect(container.textContent).not.toContain('Скопје');
    // The title still prints
    expect(screen.getByRole('heading', { name: 'Т' })).toBeInTheDocument();
  });

  it('prints the grading scale in points when enabled', () => {
    render(<DocumentLetterhead template={template({ showGradingScale: true, totalPoints: 20 })} title="Т" />);

    expect(screen.getByText(GRADING_SCALE)).toBeInTheDocument();
    // 5 spans 90–100% of 20 points → 18–20
    expect(screen.getByText('18–20')).toBeInTheDocument();
  });

  it('honours the explicit toggles', () => {
    const { container } = render(
      <DocumentLetterhead template={template({ showStudentFields: false, showPointsBox: false })} title="Т" />
    );
    expect(container.textContent).not.toMatch(ASSESSMENT);
    expect(container.textContent).not.toMatch(STUDENT_SURNAME);
  });

  it('renders without any template at all', () => {
    const { container } = render(<DocumentLetterhead template={EMPTY_TEMPLATE} title="Само наслов" />);
    expect(screen.getByRole('heading', { name: 'Само наслов' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('undefined');
  });

  it('is marked for print colour fidelity and block-level pagination', () => {
    const { container } = render(<DocumentLetterhead template={template()} title="Т" />);
    const header = container.querySelector('header');
    expect(header).toHaveAttribute('data-letterhead');
    expect(header).toHaveAttribute('data-pdf-block');
  });
});

describe('DocumentFooter', () => {
  it('prints the school, subject and a stable document reference', () => {
    const { container } = render(
      <DocumentFooter template={template()} title="Контролна" issuedAt={new Date('2026-08-23T10:00:00Z')} />
    );

    expect(container.textContent).toContain('ООУ „Блаже Конески"');
    expect(container.textContent).toContain('Математика');
    expect(container.textContent).toMatch(/MD-\d{8}-[A-Z0-9]+/);
  });

  it('falls back to a generated-by line with no school set', () => {
    const { container } = render(<DocumentFooter template={EMPTY_TEMPLATE} title="Т" />);
    expect(container.textContent).toContain('MathDigitizer');
  });

  it('disappears when the footer is switched off', () => {
    const { container } = render(<DocumentFooter template={template({ showFooter: false })} title="Т" />);
    expect(container.querySelector('footer')).toBeNull();
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathRenderer } from './MathRenderer';

vi.mock('../lib/gemini', () => ({
  explainFormula: vi.fn(),
}));

describe('MathRenderer smoke', () => {
  it('renders well-formed LaTeX without error', () => {
    render(<MathRenderer content="Решение: $x = \frac{-b}{2a}$" />);
    expect(screen.getByText(/Решение:/i)).toBeInTheDocument();
  });

  it('does not throw and still renders surrounding text when LaTeX has unbalanced braces', () => {
    expect(() =>
      render(<MathRenderer content="Формулата е $x = \frac{-b{2a$ и продолжува текстот." />)
    ).not.toThrow();
    expect(screen.getByText(/продолжува текстот/i)).toBeInTheDocument();
  });

  it('does not throw when \\left has no matching \\right', () => {
    expect(() =>
      render(<MathRenderer content="Изразот $\left( x + 1$ треба да се поедностави." />)
    ).not.toThrow();
    expect(screen.getByText(/треба да се поедностави/i)).toBeInTheDocument();
  });

  it('does not throw on a completely malformed math segment', () => {
    expect(() =>
      render(<MathRenderer content="Погледни: $\notarealcommand{{{$ ова е останатиот текст." />)
    ).not.toThrow();
    expect(screen.getByText(/ова е останатиот текст/i)).toBeInTheDocument();
  });
});

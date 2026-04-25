import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MathRenderer } from './MathRenderer';

describe('MathRenderer Component (Core EdTech Component)', () => {
  it('renders standard text without math', () => {
    render(<MathRenderer content="Обичен текст за проверка" />);
    expect(screen.getByText('Обичен текст за проверка')).toBeInTheDocument();
  });

  it('renders block equations safely without crashing', () => {
    const { container } = render(
      <MathRenderer content="Равенката е $$x^2 + y^2 = r^2$$" />
    );
    // Rehype-katex renders standard math blocks
    expect(container).toBeInTheDocument();
  });

  it('handles potential xss in markdown strings securely by escaping', () => {
    render(<MathRenderer content="<script>alert(1)</script> Некој текст" />);
    // ReactMarkdown escapes HTML tags by default, so they become literal text chars
    expect(screen.getByText('<script>alert(1)</script> Некој текст')).toBeInTheDocument();
  });
});

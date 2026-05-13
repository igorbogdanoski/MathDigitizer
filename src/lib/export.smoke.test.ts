import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToTxt } from './export';
import { MathTask } from './schema';

describe('export smoke', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates downloadable text export link', () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement('a');
    anchor.click = clickSpy;

    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return anchor;
      }
      return document.createElement(tagName);
    });

    const tasks: MathTask[] = [
      {
        id: '1',
        type: 'task',
        title: 'Тест задача',
        original_text: 'Пресметај $2+2$.',
        solution_steps: ['Собери ги броевите'],
        latex_formulas: ['2+2=4'],
        source_url: '',
        tags: ['основи'],
        difficulty: 'easy',
      },
    ];

    exportToTxt(tasks, 'smoke.txt');

    expect(anchor.getAttribute('download')).toBe('smoke.txt');
    expect(anchor.getAttribute('href')).toContain('data:text/plain;charset=utf-8,');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

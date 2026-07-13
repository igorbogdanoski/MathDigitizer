import { describe, it, expect } from 'vitest';
import { tryFastStepVerify } from './mathVerify';

describe('tryFastStepVerify', () => {
  it('confirms a numerically different but algebraically equivalent decimal form', async () => {
    const result = await tryFastStepVerify('x = 0.5', 'x = 1/2');
    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(true);
  });

  it('confirms an equivalent expanded algebraic expression', async () => {
    const result = await tryFastStepVerify('2(a+b)', '2a+2b');
    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(true);
  });

  it('confirms equivalence when the student writes extra explanatory text before a colon', async () => {
    const result = await tryFastStepVerify(
      'Прво ја изолираме променливата: x = 5',
      'Значи добивме: x = 5'
    );
    expect(result).not.toBeNull();
    expect(result?.isCorrect).toBe(true);
  });

  it('returns null (defers to AI) when the expressions are genuinely different', async () => {
    const result = await tryFastStepVerify('x = 5', 'x = 6');
    expect(result).toBeNull();
  });

  it('returns null when there is no expected step to compare against', async () => {
    const result = await tryFastStepVerify(undefined, 'x = 5');
    expect(result).toBeNull();
  });

  it('returns null (never throws) on unparseable input', async () => {
    await expect(tryFastStepVerify('x = 5', '???不明')).resolves.toBeNull();
  });

  it('returns null for pure prose with no real math content, without loading Compute Engine at all', async () => {
    const result = await tryFastStepVerify(
      'x = 5',
      'Мислам дека треба да продолжиме понатаму со следниот чекор во постапката'
    );
    expect(result).toBeNull();
  });
});

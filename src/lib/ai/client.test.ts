import { describe, it, expect, vi } from 'vitest';
import { handleGeminiError, apiUrl, withRetry } from './client';

describe('handleGeminiError', () => {
  it('maps a 429 error to the friendly quota message', () => {
    expect(() => handleGeminiError(new Error('HTTP 429 too many requests'))).toThrowError(
      /Rate Limit Exceeded/
    );
  });

  it('maps a "quota" error to the friendly quota message', () => {
    expect(() => handleGeminiError(new Error('User quota exceeded for model'))).toThrowError(
      /Rate Limit Exceeded/
    );
  });

  it('maps RESOURCE_EXHAUSTED to the friendly quota message', () => {
    expect(() => handleGeminiError(new Error('[RESOURCE_EXHAUSTED] out of quota'))).toThrowError(
      /Rate Limit Exceeded/
    );
  });

  it('suggests the faster model in the quota message', () => {
    expect(() => handleGeminiError(new Error('429'))).toThrowError(/Gemini 3 Flash/);
  });

  it('rethrows non-quota errors with their original message', () => {
    expect(() => handleGeminiError(new Error('Invalid API key provided'))).toThrowError(
      'Invalid API key provided'
    );
  });

  it('serializes non-Error values when rethrowing', () => {
    expect(() => handleGeminiError({ code: 500, detail: 'server broke' })).toThrowError(
      /server broke/
    );
  });
});

describe('withRetry', () => {
  it('retries transient 429 failures and resolves', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockResolvedValueOnce('ok');

    await expect(withRetry(fn, 2, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient errors like 404', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('404 model not found'));

    await expect(withRetry(fn, 2, 1)).rejects.toThrow('404 model not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx and network failures', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 UNAVAILABLE'))
      .mockResolvedValueOnce('ok');

    await expect(withRetry(fn, 2, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget is spent', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('429 still throttled'));

    await expect(withRetry(fn, 1, 1)).rejects.toThrow('429 still throttled');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('apiUrl', () => {
  it('appends the given path to the configured base (or returns it bare when no base)', () => {
    // VITE_API_BASE_URL may or may not be set depending on the environment;
    // either way the path must be preserved at the end of the URL.
    expect(apiUrl('/api/ai/generate-content')).toMatch(/\/api\/ai\/generate-content$/);
  });

  it('preserves dynamic path segments exactly', () => {
    expect(apiUrl('/api/ai/chats/abc123/send-message')).toMatch(
      /\/api\/ai\/chats\/abc123\/send-message$/
    );
  });
});

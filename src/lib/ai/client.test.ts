import { describe, it, expect } from 'vitest';
import { handleGeminiError, apiUrl } from './client';

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

import { describe, it, expect } from 'vitest';
import {
  PRO_MODEL,
  DEFAULT_MODEL,
  FLASH_36_MODEL,
  FAST_MODEL,
  LITE_MODEL,
  TTS_MODEL,
  IMAGE_MODEL,
  EMBEDDING_MODEL,
} from './models';

describe('ai/models', () => {
  const models = {
    PRO_MODEL,
    DEFAULT_MODEL,
    FLASH_36_MODEL,
    FAST_MODEL,
    LITE_MODEL,
    TTS_MODEL,
    IMAGE_MODEL,
    EMBEDDING_MODEL,
  };

  it('defines every model id as a non-empty gemini-* string', () => {
    for (const [name, value] of Object.entries(models)) {
      expect(value, `${name} should be a non-empty string`).toBeTruthy();
      expect(value, `${name} should be a gemini model id`).toMatch(/^gemini-/);
    }
  });

  it('keeps the embedding model on the embedding family', () => {
    expect(EMBEDDING_MODEL).toMatch(/^gemini-embedding/);
  });

  it('uses distinct models for the specialized TTS and image tasks', () => {
    expect(TTS_MODEL).not.toBe(DEFAULT_MODEL);
    expect(IMAGE_MODEL).not.toBe(DEFAULT_MODEL);
  });
});

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as models from './models';

/**
 * Model ids live in `models.ts` and nowhere else.
 *
 * That module was written to be the single source of truth, and it drifted
 * anyway: four call sites went back to literals, and one of them
 * (`PedagogueCommandCenter`) was still asking for `gemini-3-flash-preview` —
 * the oldest flash the API offers — months after the default had moved on
 * twice. Nothing failed, nothing warned; the request simply went to a weaker
 * model than the one the app thought it was using. Two more literals were the
 * model id printed in the admin UI, which would have quietly lied the moment
 * the constant changed.
 *
 * A literal is easy to write and invisible afterwards, so this makes it loud.
 */

/** Every source file, excluding this module's own home and the test files. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const MODELS_MODULE = join('src', 'lib', 'ai', 'models.ts');

describe('model ids are declared in one place', () => {
  it('appear nowhere else in the source', () => {
    // Matches an id, not the word: `gemini-3.8-flash` and `gemini-embedding-2`
    // are findings, while a comment mentioning Gemini is not.
    //
    // Deliberately not a /g regex. `RegExp.test` on a global regex advances
    // `lastIndex` and so returns a different answer for the same line
    // depending on what was tested before it — which would let a literal
    // through on any file but the first.
    const literal = /['"`]gemini-[a-z0-9.-]+['"`]/;

    const offenders = sourceFiles('src')
      .filter(path => path !== MODELS_MODULE)
      .flatMap(path => {
        const lines = readFileSync(path, 'utf8').split('\n');
        return lines
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => literal.test(line.replace(/\/\/.*$/, '')))
          .map(({ line, index }) => `${path}:${index + 1}  ${line.trim().slice(0, 80)}`);
      });

    expect(offenders, `import from ${MODELS_MODULE} instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('are all real ids rather than descriptions', () => {
    for (const [name, value] of Object.entries(models)) {
      expect(value, name).toMatch(/^gemini-[a-z0-9.-]+$/);
    }
  });

  it('pin an exact version rather than a floating alias', () => {
    // The API also offers `gemini-flash-latest` and `gemini-pro-latest`. They
    // are tempting and wrong here: the app's prompts and structured-output
    // schemas are tuned against a specific model, and a floating alias can
    // change what a teacher's extraction returns overnight, with no commit to
    // point at.
    for (const [name, value] of Object.entries(models)) {
      expect(value, `${name} follows a moving target`).not.toMatch(/-latest$/);
    }
  });

  it('keeps the pro tier on the only pro the API offers', () => {
    // `-preview` here is not staleness. Checked against the models endpoint on
    // 2026-09-03: there is no stable `gemini-3.x-pro`, so a well-meaning
    // "cleanup" that drops the suffix would point at a model that does not
    // exist.
    expect(models.PRO_MODEL).toBe('gemini-3.1-pro-preview');
  });

  it('keeps the embedding model on the embedding family', () => {
    // An embedding id and a generation id are interchangeable strings to the
    // compiler; sending one where the other belongs fails at the API, after a
    // teacher has already waited for a batch to run.
    expect(models.EMBEDDING_MODEL).toMatch(/^gemini-embedding/);
  });

  it('uses distinct models for the specialised TTS and image tasks', () => {
    expect(models.TTS_MODEL).not.toBe(models.DEFAULT_MODEL);
    expect(models.IMAGE_MODEL).not.toBe(models.DEFAULT_MODEL);
  });

  it('defaults to a newer flash than the pinned older ones', () => {
    const generation = (id: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0);

    expect(generation(models.DEFAULT_MODEL)).toBeGreaterThanOrEqual(generation(models.FLASH_37_MODEL));
    expect(generation(models.DEFAULT_MODEL)).toBeGreaterThan(generation(models.FLASH_35_MODEL));
    expect(generation(models.DEFAULT_MODEL)).toBeGreaterThan(generation(models.FAST_MODEL));
  });
});

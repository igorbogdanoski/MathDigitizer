import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  hasStored,
  isStorageAvailable,
  readStored,
  readStoredJson,
  removeStored,
  resetStorageProbe,
  writeStored,
  writeStoredJson,
} from './safeStorage';

const realLocalStorage = globalThis.localStorage;

/** Replaces localStorage for one test, and puts the real one back after. */
function useStorage(replacement: unknown) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: replacement,
    configurable: true,
    writable: true,
  });
  resetStorageProbe();
}

afterEach(() => {
  useStorage(realLocalStorage);
  resetStorageProbe();
});

describe('when storage works', () => {
  beforeEach(() => {
    useStorage(realLocalStorage);
    localStorage.clear();
  });

  it('round-trips a value', () => {
    expect(writeStored('k', 'v')).toBe(true);
    expect(readStored('k')).toBe('v');
    expect(hasStored('k')).toBe(true);
  });

  it('returns null for a key never written', () => {
    expect(readStored('missing')).toBeNull();
    expect(hasStored('missing')).toBe(false);
  });

  it('removes a value', () => {
    writeStored('k', 'v');
    expect(removeStored('k')).toBe(true);
    expect(readStored('k')).toBeNull();
  });

  it('round-trips JSON', () => {
    writeStoredJson('j', { a: 1, b: ['x'] });
    expect(readStoredJson('j', null)).toEqual({ a: 1, b: ['x'] });
  });

  it('reports itself available', () => {
    expect(isStorageAvailable()).toBe(true);
  });
});

describe('when the browser blocks site data', () => {
  // This is the case that mattered: accessing localStorage throws rather than
  // returning null, and an exception in an effect reaches the error boundary —
  // so a teacher on a locked-down school browser met an error screen instead of
  // the app.
  const throwing = {
    getItem() { throw new DOMException('blocked', 'SecurityError'); },
    setItem() { throw new DOMException('blocked', 'SecurityError'); },
    removeItem() { throw new DOMException('blocked', 'SecurityError'); },
  };

  beforeEach(() => useStorage(throwing));

  it('never throws out to the caller', () => {
    expect(() => readStored('k')).not.toThrow();
    expect(() => writeStored('k', 'v')).not.toThrow();
    expect(() => removeStored('k')).not.toThrow();
    expect(() => readStoredJson('k', 'fallback')).not.toThrow();
    expect(() => writeStoredJson('k', {})).not.toThrow();
    expect(() => isStorageAvailable()).not.toThrow();
  });

  it('answers as though nothing was ever stored, which is true', () => {
    expect(readStored('k')).toBeNull();
    expect(hasStored('k')).toBe(false);
    expect(readStoredJson('k', 'fallback')).toBe('fallback');
  });

  it('says plainly that a write did not stick', () => {
    // The caller can then decide; silently claiming success would let a screen
    // promise a preference it cannot keep.
    expect(writeStored('k', 'v')).toBe(false);
    expect(writeStoredJson('k', {})).toBe(false);
    expect(isStorageAvailable()).toBe(false);
  });
});

describe('when localStorage is not there at all', () => {
  beforeEach(() => useStorage(undefined));

  it('behaves as it does when blocked', () => {
    expect(readStored('k')).toBeNull();
    expect(writeStored('k', 'v')).toBe(false);
    expect(isStorageAvailable()).toBe(false);
  });
});

describe('when the quota is full', () => {
  // Reads work, writes throw. A browser at its limit must not lose the app.
  beforeEach(() => useStorage({
    getItem: () => 'existing',
    setItem: () => { throw new DOMException('exceeded', 'QuotaExceededError'); },
    removeItem: () => undefined,
  }));

  it('still reads, and reports the failed write', () => {
    expect(writeStored('k', 'v')).toBe(false);
    // The probe writes, so a store that refuses every write reads as
    // unavailable — which is the safe reading, since nothing new can be kept.
    expect(isStorageAvailable()).toBe(false);
  });
});

describe('readStoredJson', () => {
  beforeEach(() => {
    useStorage(realLocalStorage);
    localStorage.clear();
  });

  it('falls back on malformed JSON rather than throwing', () => {
    // Stored JSON is only as trustworthy as the version that wrote it. A shape
    // that changed between releases must not crash the release reading it.
    localStorage.setItem('j', '{not json');
    expect(readStoredJson('j', { safe: true })).toEqual({ safe: true });
  });

  it('falls back for a key never written', () => {
    expect(readStoredJson('missing', 42)).toBe(42);
  });

  it('refuses a value that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(writeStoredJson('c', cyclic)).toBe(false);
  });
});

describe('the availability probe', () => {
  it('writes rather than trusting that the object exists', () => {
    // Some browsers expose localStorage and only throw on use, so checking for
    // the object proves nothing.
    const setItem = vi.fn(() => { throw new Error('nope'); });
    useStorage({ getItem: () => null, setItem, removeItem: () => undefined });

    expect(isStorageAvailable()).toBe(false);
    expect(setItem).toHaveBeenCalled();
  });

  it('probes once and remembers', () => {
    const setItem = vi.fn();
    useStorage({ getItem: () => null, setItem, removeItem: () => undefined });

    isStorageAvailable();
    isStorageAvailable();
    readStored('k');

    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

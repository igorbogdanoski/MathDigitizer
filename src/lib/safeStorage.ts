/**
 * Browser storage that cannot take the app down with it.
 *
 * `localStorage` is not always there and not always allowed. Accessing it
 * throws — not returns null, throws — when site data is blocked, which happens
 * in locked-down school and corporate browsers, in some private modes, and
 * whenever a user has turned off storage for the site.
 *
 * That mattered because `Layout` read the saved theme in an effect on every
 * load. An exception in an effect reaches the nearest error boundary, so a
 * teacher on a school machine with site data blocked met an error screen
 * instead of the app, with nothing on it to explain why. The preference is not
 * worth a screen.
 *
 * Everything here fails quietly to the value the caller would have got if
 * nothing had ever been stored, which is the honest answer: on that browser,
 * nothing was.
 */

/** The part of `Storage` this app uses. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The real `localStorage`, or null where it cannot be reached.
 *
 * Probed with an actual write. Some browsers expose the object and only throw
 * on use, so checking that it exists proves nothing.
 */
function resolveStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__md_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

let cached: KeyValueStore | null | undefined;

function store(): KeyValueStore | null {
  if (cached === undefined) cached = resolveStore();
  return cached;
}

/** Forgets the probe result. For tests, and after a permission change. */
export function resetStorageProbe(): void {
  cached = undefined;
}

/** Whether anything written here will survive a reload. */
export function isStorageAvailable(): boolean {
  return store() !== null;
}

/** The stored value, or null — including when storage itself is unavailable. */
export function readStored(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Stores a value. Returns false when it could not be kept. */
export function writeStored(key: string, value: string): boolean {
  try {
    const target = store();
    if (!target) return false;
    target.setItem(key, value);
    return true;
  } catch {
    // Also covers a full quota, which throws on write even where storage works.
    return false;
  }
}

export function removeStored(key: string): boolean {
  try {
    const target = store();
    if (!target) return false;
    target.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** True when a key has been written. Convenience for flags. */
export function hasStored(key: string): boolean {
  return readStored(key) !== null;
}

/**
 * Reads and parses JSON.
 *
 * Returns the fallback for missing, unreadable and malformed values alike —
 * stored JSON is only as trustworthy as the version of the app that wrote it,
 * and a shape that changed between releases must not crash the one reading it.
 */
export function readStoredJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): boolean {
  try {
    return writeStored(key, JSON.stringify(value));
  } catch {
    // A value with a cycle in it, which stringify refuses.
    return false;
  }
}

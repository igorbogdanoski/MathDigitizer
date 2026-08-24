import { readStoredJson, writeStoredJson } from './safeStorage';
import * as Sentry from '@sentry/react';

export type ObservabilitySeverity = 'info' | 'warning' | 'error';

export interface ObservabilityEvent {
  id: string;
  type: 'error' | 'timing' | 'route';
  severity: ObservabilitySeverity;
  name: string;
  message: string;
  timestamp: string;
  durationMs?: number;
  path?: string;
  details?: Record<string, unknown>;
}

const STORAGE_KEY = 'mathdigitizer.observability.v1';
const MAX_EVENTS = 50;

// This module's own guard used to check that `window.localStorage` existed,
// which proves nothing: when site data is blocked the object is there and the
// methods throw. The shared layer probes with a real write.
function readEvents(): ObservabilityEvent[] {
  const parsed = readStoredJson<ObservabilityEvent[]>(STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeEvents(events: ObservabilityEvent[]) {
  writeStoredJson(STORAGE_KEY, events.slice(0, MAX_EVENTS));
}

function pushEvent(event: ObservabilityEvent) {
  const next = [event, ...readEvents()].slice(0, MAX_EVENTS);
  writeEvents(next);

  if (typeof window !== 'undefined') {
    const target = window as Window & { __MD_OBSERVABILITY__?: ObservabilityEvent[] };
    target.__MD_OBSERVABILITY__ = next;
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Unhandled errors/rejections are already captured natively by Sentry's
// browser integrations (wired in Sentry.init), so we skip forwarding those to
// avoid duplicate events. Every other (handled) error is forwarded below.
const SENTRY_NATIVE_EVENTS = new Set(['unhandled-window-error', 'unhandled-promise-rejection']);

const SENTRY_LEVEL: Record<ObservabilitySeverity, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
};

export function captureError(error: unknown, context: { name: string; path?: string; severity?: ObservabilitySeverity; details?: Record<string, unknown> }) {
  const event: ObservabilityEvent = {
    id: createId('err'),
    type: 'error',
    severity: context.severity ?? 'error',
    name: context.name,
    message: toMessage(error),
    timestamp: new Date().toISOString(),
    path: context.path,
    details: context.details,
  };

  pushEvent(event);
  console.error(`[observability] ${context.name}`, error);

  if (!SENTRY_NATIVE_EVENTS.has(context.name)) {
    Sentry.captureException(error instanceof Error ? error : new Error(event.message), {
      level: SENTRY_LEVEL[event.severity],
      tags: { name: context.name, path: context.path },
      extra: context.details,
    });
  }

  return event;
}

export function recordTiming(name: string, durationMs: number, context?: { path?: string; severity?: ObservabilitySeverity; details?: Record<string, unknown> }) {
  const event: ObservabilityEvent = {
    id: createId('tim'),
    type: 'timing',
    severity: context?.severity ?? 'info',
    name,
    message: `${name} took ${durationMs.toFixed(1)}ms`,
    timestamp: new Date().toISOString(),
    durationMs,
    path: context?.path,
    details: context?.details,
  };

  pushEvent(event);
  return event;
}

export function recordRouteView(path: string, durationMs?: number) {
  const event: ObservabilityEvent = {
    id: createId('route'),
    type: 'route',
    severity: 'info',
    name: 'route-view',
    message: `Viewed route ${path}`,
    timestamp: new Date().toISOString(),
    durationMs,
    path,
  };

  pushEvent(event);
  return event;
}

export function getObservabilityEvents(): ObservabilityEvent[] {
  return readEvents();
}

export function clearObservabilityEvents() {
  writeEvents([]);
  if (typeof window !== 'undefined') {
    const target = window as Window & { __MD_OBSERVABILITY__?: ObservabilityEvent[] };
    target.__MD_OBSERVABILITY__ = [];
  }
}

let globalHandlersInstalled = false;

export function installGlobalObservabilityHandlers() {
  if (globalHandlersInstalled || typeof window === 'undefined') return;
  globalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, {
      name: 'unhandled-window-error',
      path: window.location.pathname,
      severity: 'error',
      details: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, {
      name: 'unhandled-promise-rejection',
      path: window.location.pathname,
      severity: 'error',
    });
  });
}

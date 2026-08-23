/**
 * Whiteboard synchronisation protocol — pure reducer over the socket events
 * (EXPERT_LEVEL_MASTER_PLAN, Phase 4.4 and 4.5).
 *
 * Before this module a stroke was only broadcast on pointer-up, so remote
 * participants watched the teacher's ink appear in finished lumps, and anyone
 * joining mid-session saw an empty board. The protocol here streams points
 * while drawing (sequence-numbered, deduped, tolerant of reordering) and lets a
 * late joiner ask the room for a snapshot.
 */

export type StrokeTool = 'pen' | 'eraser';

export interface Stroke {
  id: string;
  points: number[];
  /** Per-point widths for variable-width ink; absent on legacy strokes. */
  widths?: number[];
  color: string;
  thickness: number;
  /** Explicit tool — replaces the old "white colour means eraser" heuristic. */
  tool: StrokeTool;
  authorId: string;
}

export interface LatexBox {
  id: string;
  /** LaTeX source, or a JSXGraph script when `kind` is 'geometry'. */
  text: string;
  x: number;
  y: number;
  /** Absent on boxes saved before shape-from-text existed — treat as 'latex'. */
  kind?: 'latex' | 'geometry';
}

export interface BoardState {
  strokes: Stroke[];
  latexBoxes: LatexBox[];
  /** Highest sequence number applied per stroke — the dedupe key. */
  appliedSeq: Record<string, number>;
  /** Chunks that arrived ahead of their predecessor, held until the gap fills. */
  pending: Record<string, StrokePointsEvent[]>;
}

export interface StrokeBeginEvent {
  type: 'stroke:begin';
  stroke: Stroke;
  seq: number;
}

export interface StrokePointsEvent {
  type: 'stroke:points';
  strokeId: string;
  seq: number;
  points: number[];
  widths?: number[];
}

export interface StrokeEndEvent {
  type: 'stroke:end';
  strokeId: string;
  seq: number;
}

export interface StrokeUndoEvent {
  type: 'stroke:undo';
  strokeId: string;
  authorId: string;
}

export interface StrokeRedoEvent {
  type: 'stroke:redo';
  stroke: Stroke;
}

export interface ClearEvent {
  type: 'stroke:clear';
}

export interface SnapshotRequestEvent {
  type: 'snapshot:request';
  requesterId: string;
}

export interface SnapshotProvideEvent {
  type: 'snapshot:provide';
  /** Client id the snapshot is addressed to; everyone else ignores it. */
  to: string;
  strokes: Stroke[];
  latexBoxes: LatexBox[];
}

export interface LatexAddEvent {
  type: 'latex:add';
  latex: LatexBox;
}

export interface LatexMoveEvent {
  type: 'latex:move';
  latex: LatexBox;
}

export type CanvasEvent =
  | StrokeBeginEvent
  | StrokePointsEvent
  | StrokeEndEvent
  | StrokeUndoEvent
  | StrokeRedoEvent
  | ClearEvent
  | SnapshotRequestEvent
  | SnapshotProvideEvent
  | LatexAddEvent
  | LatexMoveEvent;

export function createBoardState(strokes: Stroke[] = [], latexBoxes: LatexBox[] = []): BoardState {
  return { strokes, latexBoxes, appliedSeq: {}, pending: {} };
}

/**
 * Applies one incoming event. Always returns a new state object when something
 * changed, and the *same* object when the event was a duplicate or is not for
 * this client — so React can skip re-rendering on the (frequent) no-op case.
 */
export function applyCanvasEvent(state: BoardState, event: CanvasEvent, selfId: string): BoardState {
  switch (event.type) {
    case 'stroke:begin': {
      if (state.strokes.some(s => s.id === event.stroke.id)) return state;
      return flushPending(
        {
          ...state,
          strokes: [...state.strokes, event.stroke],
          appliedSeq: { ...state.appliedSeq, [event.stroke.id]: event.seq },
        },
        event.stroke.id
      );
    }

    case 'stroke:points': {
      const applied = state.appliedSeq[event.strokeId];
      // Unknown stroke, or a chunk we already have — drop it.
      if (applied === undefined) return state;
      if (event.seq <= applied) return state;

      // Arrived early: hold it until the missing chunk shows up.
      if (event.seq > applied + 1) {
        const held = state.pending[event.strokeId] ?? [];
        if (held.some(e => e.seq === event.seq)) return state;
        return {
          ...state,
          pending: { ...state.pending, [event.strokeId]: [...held, event] },
        };
      }

      return flushPending(appendPoints(state, event), event.strokeId);
    }

    case 'stroke:end': {
      const applied = state.appliedSeq[event.strokeId];
      if (applied === undefined) return state;
      const { [event.strokeId]: _dropped, ...pending } = state.pending;
      return { ...state, pending };
    }

    case 'stroke:undo': {
      if (!state.strokes.some(s => s.id === event.strokeId && s.authorId === event.authorId)) {
        return state;
      }
      return { ...state, strokes: state.strokes.filter(s => s.id !== event.strokeId) };
    }

    case 'stroke:redo': {
      if (state.strokes.some(s => s.id === event.stroke.id)) return state;
      return { ...state, strokes: [...state.strokes, event.stroke] };
    }

    case 'stroke:clear':
      return createBoardState([], []);

    case 'snapshot:request':
      // Answering is the caller's job (it needs the socket); state is untouched.
      return state;

    case 'snapshot:provide': {
      if (event.to !== selfId) return state;
      // A late joiner may already have drawn something locally; never discard it.
      const localOnly = state.strokes.filter(s => !event.strokes.some(remote => remote.id === s.id));
      return createBoardState([...event.strokes, ...localOnly], event.latexBoxes);
    }

    case 'latex:add': {
      if (state.latexBoxes.some(b => b.id === event.latex.id)) return state;
      return { ...state, latexBoxes: [...state.latexBoxes, event.latex] };
    }

    case 'latex:move':
      return {
        ...state,
        latexBoxes: state.latexBoxes.map(b => (b.id === event.latex.id ? event.latex : b)),
      };

    default:
      return state;
  }
}

function appendPoints(state: BoardState, event: StrokePointsEvent): BoardState {
  return {
    ...state,
    strokes: state.strokes.map(stroke =>
      stroke.id === event.strokeId
        ? {
            ...stroke,
            points: [...stroke.points, ...event.points],
            widths: event.widths ? [...(stroke.widths ?? []), ...event.widths] : stroke.widths,
          }
        : stroke
    ),
    appliedSeq: { ...state.appliedSeq, [event.strokeId]: event.seq },
  };
}

/** Drains buffered chunks that have become contiguous after the latest apply. */
function flushPending(state: BoardState, strokeId: string): BoardState {
  const held = state.pending[strokeId];
  if (!held || held.length === 0) return state;

  let next = state;
  let queue = [...held];
  let progressed = true;

  while (progressed) {
    progressed = false;
    const applied = next.appliedSeq[strokeId] ?? -1;
    const index = queue.findIndex(e => e.seq === applied + 1);
    if (index !== -1) {
      next = appendPoints(next, queue[index]);
      queue = queue.filter((_, i) => i !== index);
      progressed = true;
    }
  }

  return { ...next, pending: { ...next.pending, [strokeId]: queue } };
}

/**
 * Immediate append for the client that is drawing.
 *
 * The server relays with `socket.to(room)`, so a client never receives its own
 * events — its ink must be applied locally, without the sequence bookkeeping
 * that only matters for the receiving side.
 */
export function appendLocalPoints(
  state: BoardState,
  strokeId: string,
  points: number[],
  widths?: number[]
): BoardState {
  if (points.length === 0) return state;
  return {
    ...state,
    strokes: state.strokes.map(stroke =>
      stroke.id === strokeId
        ? {
            ...stroke,
            points: [...stroke.points, ...points],
            widths: widths?.length ? [...(stroke.widths ?? []), ...widths] : stroke.widths,
          }
        : stroke
    ),
  };
}

/**
 * Splits the points collected since the last emit into a wire chunk.
 * Kept pure so the throttling component stays trivial and testable.
 */
export function buildPointsChunk(
  strokeId: string,
  seq: number,
  points: number[],
  widths?: number[]
): StrokePointsEvent | null {
  if (points.length === 0) return null;
  return { type: 'stroke:points', strokeId, seq, points, ...(widths?.length ? { widths } : {}) };
}

/** Strokes drawn by one participant, newest last — the per-user undo stack. */
export function strokesByAuthor(state: BoardState, authorId: string): Stroke[] {
  return state.strokes.filter(s => s.authorId === authorId);
}

/** The stroke this participant's next undo would remove, if any. */
export function lastStrokeOf(state: BoardState, authorId: string): Stroke | null {
  const own = strokesByAuthor(state, authorId);
  return own.length > 0 ? own[own.length - 1] : null;
}

/** How often the drawing client flushes buffered points to the room. */
export const POINT_STREAM_THROTTLE_MS = 60;

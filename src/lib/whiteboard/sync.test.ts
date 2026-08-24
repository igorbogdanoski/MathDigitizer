import { describe, it, expect } from 'vitest';
import {
  Stroke,
  createBoardState,
  applyCanvasEvent,
  buildPointsChunk,
  strokesByAuthor,
  lastStrokeOf,
  POINT_STREAM_THROTTLE_MS,
} from './sync';

const SELF = 'me';

const stroke = (over: Partial<Stroke> = {}): Stroke => ({
  id: 's1',
  points: [0, 0],
  widths: [3],
  color: '#000',
  thickness: 3,
  tool: 'pen',
  authorId: 'teacher',
  ...over,
});

const begin = (s = stroke()) => ({ type: 'stroke:begin' as const, stroke: s, seq: 0 });
const chunk = (seq: number, points: number[], widths?: number[], strokeId = 's1') => ({
  type: 'stroke:points' as const,
  strokeId,
  seq,
  points,
  ...(widths ? { widths } : {}),
});

describe('stroke streaming', () => {
  it('appends points as chunks arrive in order', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    state = applyCanvasEvent(state, chunk(1, [10, 10], [3]), SELF);
    state = applyCanvasEvent(state, chunk(2, [20, 20], [4]), SELF);

    expect(state.strokes[0].points).toEqual([0, 0, 10, 10, 20, 20]);
    expect(state.strokes[0].widths).toEqual([3, 3, 4]);
  });

  it('ignores a duplicated chunk', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    state = applyCanvasEvent(state, chunk(1, [10, 10]), SELF);
    const afterFirst = state;

    state = applyCanvasEvent(state, chunk(1, [10, 10]), SELF);

    expect(state).toBe(afterFirst); // same reference: no re-render
    expect(state.strokes[0].points).toEqual([0, 0, 10, 10]);
  });

  it('buffers an early chunk and applies it once the gap fills', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);

    // seq 2 arrives before seq 1
    state = applyCanvasEvent(state, chunk(2, [20, 20]), SELF);
    expect(state.strokes[0].points).toEqual([0, 0]);
    expect(state.pending['s1']).toHaveLength(1);

    state = applyCanvasEvent(state, chunk(1, [10, 10]), SELF);
    expect(state.strokes[0].points).toEqual([0, 0, 10, 10, 20, 20]);
    expect(state.pending['s1']).toHaveLength(0);
  });

  it('drains a run of buffered chunks in sequence order', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    state = applyCanvasEvent(state, chunk(3, [30, 30]), SELF);
    state = applyCanvasEvent(state, chunk(2, [20, 20]), SELF);
    state = applyCanvasEvent(state, chunk(1, [10, 10]), SELF);

    expect(state.strokes[0].points).toEqual([0, 0, 10, 10, 20, 20, 30, 30]);
  });

  it('drops points for a stroke it never saw begin', () => {
    const state = createBoardState();
    const next = applyCanvasEvent(state, chunk(1, [10, 10], undefined, 'ghost'), SELF);
    expect(next).toBe(state);
  });

  it('ignores a duplicated begin', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    const after = state;
    state = applyCanvasEvent(state, begin(), SELF);
    expect(state).toBe(after);
    expect(state.strokes).toHaveLength(1);
  });

  it('clears the pending buffer when the stroke ends', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    state = applyCanvasEvent(state, chunk(5, [50, 50]), SELF);
    expect(state.pending['s1']).toHaveLength(1);

    state = applyCanvasEvent(state, { type: 'stroke:end', strokeId: 's1', seq: 5 }, SELF);
    expect(state.pending['s1']).toBeUndefined();
  });
});

describe('undo / redo per user', () => {
  const board = () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(stroke({ id: 'a', authorId: 'teacher' })), SELF);
    state = applyCanvasEvent(state, begin(stroke({ id: 'b', authorId: 'student' })), SELF);
    state = applyCanvasEvent(state, begin(stroke({ id: 'c', authorId: 'teacher' })), SELF);
    return state;
  };

  it('removes only the addressed stroke', () => {
    const state = applyCanvasEvent(board(), { type: 'stroke:undo', strokeId: 'c', authorId: 'teacher' }, SELF);
    expect(state.strokes.map(s => s.id)).toEqual(['a', 'b']);
  });

  it('refuses to undo another participant\'s stroke', () => {
    const before = board();
    const after = applyCanvasEvent(before, { type: 'stroke:undo', strokeId: 'b', authorId: 'teacher' }, SELF);
    expect(after).toBe(before);
  });

  it('restores a stroke on redo without duplicating it', () => {
    let state = applyCanvasEvent(board(), { type: 'stroke:undo', strokeId: 'c', authorId: 'teacher' }, SELF);
    const restored = stroke({ id: 'c', authorId: 'teacher' });

    state = applyCanvasEvent(state, { type: 'stroke:redo', stroke: restored }, SELF);
    expect(state.strokes.map(s => s.id)).toEqual(['a', 'b', 'c']);

    const again = applyCanvasEvent(state, { type: 'stroke:redo', stroke: restored }, SELF);
    expect(again).toBe(state);
  });

  it('reports each participant\'s own stroke stack', () => {
    const state = board();
    expect(strokesByAuthor(state, 'teacher').map(s => s.id)).toEqual(['a', 'c']);
    expect(lastStrokeOf(state, 'teacher')?.id).toBe('c');
    expect(lastStrokeOf(state, 'nobody')).toBeNull();
  });
});

describe('late-join snapshot', () => {
  it('adopts a snapshot addressed to this client', () => {
    const state = createBoardState();
    const next = applyCanvasEvent(
      state,
      { type: 'snapshot:provide', to: SELF, strokes: [stroke({ id: 'x' })], latexBoxes: [] },
      SELF
    );
    expect(next.strokes.map(s => s.id)).toEqual(['x']);
  });

  it('ignores a snapshot addressed to somebody else', () => {
    const state = createBoardState();
    const next = applyCanvasEvent(
      state,
      { type: 'snapshot:provide', to: 'other', strokes: [stroke({ id: 'x' })], latexBoxes: [] },
      SELF
    );
    expect(next).toBe(state);
  });

  it('never discards ink the joiner already drew locally', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(stroke({ id: 'local', authorId: SELF })), SELF);

    state = applyCanvasEvent(
      state,
      { type: 'snapshot:provide', to: SELF, strokes: [stroke({ id: 'remote' })], latexBoxes: [] },
      SELF
    );

    expect(state.strokes.map(s => s.id).sort()).toEqual(['local', 'remote']);
  });

  it('leaves state untouched for a snapshot request', () => {
    const state = createBoardState();
    expect(applyCanvasEvent(state, { type: 'snapshot:request', requesterId: 'joiner' }, SELF)).toBe(state);
  });
});

describe('latex boxes and clear', () => {
  it('adds a box once', () => {
    let state = createBoardState();
    const latex = { id: 'l1', text: 'x^2', x: 10, y: 20 };
    state = applyCanvasEvent(state, { type: 'latex:add', latex }, SELF);
    const after = state;
    state = applyCanvasEvent(state, { type: 'latex:add', latex }, SELF);
    expect(state).toBe(after);
    expect(state.latexBoxes).toHaveLength(1);
  });

  it('moves an existing box', () => {
    let state = createBoardState([], [{ id: 'l1', text: 'x', x: 0, y: 0 }]);
    state = applyCanvasEvent(state, { type: 'latex:move', latex: { id: 'l1', text: 'x', x: 99, y: 5 } }, SELF);
    expect(state.latexBoxes[0]).toMatchObject({ x: 99, y: 5 });
  });

  it('resets everything on clear, including sequence bookkeeping', () => {
    let state = createBoardState();
    state = applyCanvasEvent(state, begin(), SELF);
    state = applyCanvasEvent(state, chunk(1, [1, 1]), SELF);

    state = applyCanvasEvent(state, { type: 'stroke:clear' }, SELF);
    expect(state.strokes).toEqual([]);
    expect(state.latexBoxes).toEqual([]);
    expect(state.appliedSeq).toEqual({});
  });
});

describe('buildPointsChunk', () => {
  it('builds a wire chunk from buffered points', () => {
    expect(buildPointsChunk('s1', 4, [1, 2], [3])).toEqual({
      type: 'stroke:points',
      strokeId: 's1',
      seq: 4,
      points: [1, 2],
      widths: [3],
    });
  });

  it('returns null when there is nothing to send', () => {
    expect(buildPointsChunk('s1', 4, [])).toBeNull();
  });

  it('omits widths when none were collected', () => {
    expect(buildPointsChunk('s1', 1, [1, 2], [])).not.toHaveProperty('widths');
  });
});

describe('POINT_STREAM_THROTTLE_MS', () => {
  it('is the ~60ms cadence the plan specifies', () => {
    expect(POINT_STREAM_THROTTLE_MS).toBe(60);
  });
});

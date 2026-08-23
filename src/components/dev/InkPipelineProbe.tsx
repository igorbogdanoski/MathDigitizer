import React, { useRef, useState } from 'react';
import { shouldIgnorePointer } from '../../lib/whiteboard/ink';
import { StrokeBuilder } from '../../lib/whiteboard/strokeBuilder';
import {
  BoardState,
  Stroke,
  appendLocalPoints,
  applyCanvasEvent,
  buildPointsChunk,
  createBoardState,
  lastStrokeOf,
  POINT_STREAM_THROTTLE_MS,
} from '../../lib/whiteboard/sync';

/**
 * DEV-only probe for the whiteboard ink pipeline (Phase 4.7).
 *
 * The real board lives behind auth and renders through Konva, neither of which
 * an e2e run can drive with synthetic pointer events. This probe wires the very
 * same StrokeBuilder + sync reducer to a plain DOM surface and mirrors every
 * emitted chunk into a second board state, so a test can assert the property
 * that actually matters: what the drawer sees and what a remote participant
 * receives are identical, even when chunks arrive late or twice.
 */
const LOCAL_ID = 'probe-local';

export const InkPipelineProbe: React.FC = () => {
  const [local, setLocal] = useState<BoardState>(() => createBoardState());
  const [remote, setRemote] = useState<BoardState>(() => createBoardState());
  const [ignoredCount, setIgnoredCount] = useState(0);

  const drawingRef = useRef<{
    strokeId: string;
    seq: number;
    builder: StrokeBuilder;
    pending: { points: number[]; widths: number[] };
  } | null>(null);
  const penLastSeenRef = useRef<number | null>(null);
  const redoRef = useRef<Stroke[]>([]);

  /** Stands in for the socket: every emitted event reaches the mirror board. */
  const emit = (event: Parameters<typeof applyCanvasEvent>[1], repeat = false) => {
    setRemote(prev => {
      const once = applyCanvasEvent(prev, event, 'probe-remote');
      // Duplicated delivery must be a no-op — assert it here, in the pipeline.
      return repeat ? applyCanvasEvent(once, event, 'probe-remote') : once;
    });
  };

  const flush = (force: boolean) => {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pending.points.length === 0) return;
    if (!force && drawing.pending.points.length < 2) return;

    const chunk = buildPointsChunk(
      drawing.strokeId,
      drawing.seq + 1,
      drawing.pending.points,
      drawing.pending.widths
    );
    if (chunk) {
      drawing.seq += 1;
      // Deliver every second chunk twice, to exercise the dedupe path.
      emit(chunk, drawing.seq % 2 === 0);
    }
    drawing.pending = { points: [], widths: [] };
  };

  const readSample = (e: React.PointerEvent) => {
    const now = e.timeStamp || performance.now();
    if (e.pointerType === 'pen') penLastSeenRef.current = now;
    if (shouldIgnorePointer({ pointerType: e.pointerType, penLastSeenAt: penLastSeenRef.current, now })) {
      setIgnoredCount(c => c + 1);
      return null;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure,
      t: now,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const sample = readSample(e);
    if (!sample) return;

    const builder = new StrokeBuilder(sample, { baseWidth: 3, pointerType: e.pointerType });
    const stroke: Stroke = {
      id: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      points: [sample.x, sample.y],
      widths: [builder.initialWidth],
      color: '#4f46e5',
      thickness: 3,
      tool: 'pen',
      authorId: LOCAL_ID,
    };

    drawingRef.current = { strokeId: stroke.id, seq: 0, builder, pending: { points: [], widths: [] } };
    redoRef.current = [];

    setLocal(prev => applyCanvasEvent(prev, { type: 'stroke:begin', stroke, seq: 0 }, LOCAL_ID));
    emit({ type: 'stroke:begin', stroke, seq: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drawing = drawingRef.current;
    if (!drawing) return;
    const sample = readSample(e);
    if (!sample) return;

    const increment = drawing.builder.addSample(sample);
    if (!increment) return;

    drawing.pending.points.push(...increment.points);
    drawing.pending.widths.push(...increment.widths);
    setLocal(prev => appendLocalPoints(prev, drawing.strokeId, increment.points, increment.widths));
    flush(false);
  };

  const onPointerUp = () => {
    const drawing = drawingRef.current;
    if (!drawing) return;

    const closing = drawing.builder.finish();
    if (closing) {
      drawing.pending.points.push(...closing.points);
      drawing.pending.widths.push(...closing.widths);
      setLocal(prev => appendLocalPoints(prev, drawing.strokeId, closing.points, closing.widths));
    }
    flush(true);
    emit({ type: 'stroke:end', strokeId: drawing.strokeId, seq: drawing.seq });
    drawingRef.current = null;
  };

  const undo = () => {
    const target = lastStrokeOf(local, LOCAL_ID);
    if (!target) return;
    redoRef.current.push(target);
    const event = { type: 'stroke:undo' as const, strokeId: target.id, authorId: LOCAL_ID };
    setLocal(prev => applyCanvasEvent(prev, event, LOCAL_ID));
    emit(event);
  };

  const redo = () => {
    const restored = redoRef.current.pop();
    if (!restored) return;
    const event = { type: 'stroke:redo' as const, stroke: restored };
    setLocal(prev => applyCanvasEvent(prev, event, LOCAL_ID));
    emit(event);
  };

  /** Simulates a participant joining after the ink was drawn. */
  const lateJoin = () => {
    setRemote(() =>
      applyCanvasEvent(
        createBoardState(),
        { type: 'snapshot:provide', to: 'joiner', strokes: local.strokes, latexBoxes: local.latexBoxes },
        'joiner'
      )
    );
  };

  const describe = (state: BoardState) =>
    JSON.stringify({
      strokes: state.strokes.length,
      points: state.strokes.map(s => s.points.length),
      widths: state.strokes.map(s => s.widths?.length ?? 0),
      distinctWidths: state.strokes.map(s => new Set(s.widths ?? []).size),
    });

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h1>Ink Pipeline Probe</h1>

      <div
        data-testid="ink-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          width: 600,
          height: 300,
          border: '1px solid #94a3b8',
          background: '#fff',
          touchAction: 'none',
          userSelect: 'none',
          overscrollBehavior: 'none',
        }}
      />

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button data-testid="undo" onClick={undo}>undo</button>
        <button data-testid="redo" onClick={redo}>redo</button>
        <button data-testid="late-join" onClick={lateJoin}>late join</button>
      </div>

      <pre data-testid="local-state">{describe(local)}</pre>
      <pre data-testid="remote-state">{describe(remote)}</pre>
      <pre data-testid="local-points-raw">{JSON.stringify(local.strokes.map(s => s.points))}</pre>
      <pre data-testid="remote-points-raw">{JSON.stringify(remote.strokes.map(s => s.points))}</pre>
      <pre data-testid="ignored-count">{ignoredCount}</pre>
      <pre data-testid="throttle-ms">{POINT_STREAM_THROTTLE_MS}</pre>
    </div>
  );
};

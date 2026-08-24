import { describe, it, expect } from 'vitest';
import { addEdge, addNode, createConceptMap } from './graph';
import { arrangeMap } from './autoLayout';

const chain = (count: number) => {
  let map = createConceptMap('m', 'u', 'M');
  for (let i = 0; i < count; i++) {
    map = addNode(map, { id: `n${i}`, label: `Поим ${i}`, x: 0, y: 0 });
  }
  for (let i = 1; i < count; i++) {
    map = addEdge(map, { id: `e${i}`, source: `n${i - 1}`, target: `n${i}`, kind: 'relates' });
  }
  return map;
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('arrangeMap', () => {
  it('is deterministic — arranging twice gives the same map', () => {
    // Pressing the button again must not shuffle a teacher's work into
    // something unrecognisable.
    const map = chain(8);
    expect(arrangeMap(map).nodes).toEqual(arrangeMap(map).nodes);
  });

  it('separates nodes that all started at the same point', () => {
    // Every node is added at (0,0) until it is placed. Without a deterministic
    // nudge, coincident nodes divide by zero and stay stacked.
    const arranged = arrangeMap(chain(6));

    for (let i = 0; i < arranged.nodes.length; i++) {
      for (let j = i + 1; j < arranged.nodes.length; j++) {
        expect(distance(arranged.nodes[i], arranged.nodes[j])).toBeGreaterThan(20);
      }
    }
  });

  it('puts connected nodes nearer than unconnected ones', () => {
    let map = createConceptMap('m', 'u', 'M');
    for (const id of ['a', 'b', 'c', 'd']) {
      map = addNode(map, { id, label: id, x: 0, y: 0 });
    }
    map = addEdge(map, { id: 'e1', source: 'a', target: 'b', kind: 'relates' });

    const arranged = arrangeMap(map);
    const at = (id: string) => arranged.nodes.find(n => n.id === id)!;

    expect(distance(at('a'), at('b'))).toBeLessThan(distance(at('c'), at('d')));
  });

  it('keeps every node on the canvas rather than flinging one off', () => {
    const arranged = arrangeMap(chain(12), { width: 900, height: 600 });

    for (const node of arranged.nodes) {
      expect(Math.abs(node.x)).toBeLessThan(4000);
      expect(Math.abs(node.y)).toBeLessThan(4000);
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('centres a single node instead of leaving it wherever it was', () => {
    let map = createConceptMap('m', 'u', 'M');
    map = addNode(map, { id: 'a', label: 'A', x: -900, y: 4000 });

    expect(arrangeMap(map, { width: 800, height: 400 }).nodes[0]).toMatchObject({ x: 400, y: 200 });
  });

  it('returns an empty map untouched', () => {
    const map = createConceptMap('m', 'u', 'M');
    expect(arrangeMap(map)).toBe(map);
  });

  it('ignores an edge whose endpoint is gone', () => {
    const map = { ...chain(3), edges: [{ id: 'x', source: 'n0', target: 'ghost', kind: 'relates' as const }] };
    expect(() => arrangeMap(map)).not.toThrow();
  });

  it('changes nothing but coordinates', () => {
    const map = chain(4);
    const arranged = arrangeMap(map);

    expect(arranged.edges).toEqual(map.edges);
    expect(arranged.nodes.map(n => n.label)).toEqual(map.nodes.map(n => n.label));
    expect(arranged.title).toBe(map.title);
  });
});

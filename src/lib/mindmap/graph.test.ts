import { describe, it, expect } from 'vitest';
import {
  ConceptMap,
  addEdge,
  addNode,
  attachOutcome,
  attachTask,
  createConceptMap,
  detachOutcome,
  detachTask,
  findMapProblems,
  removeEdge,
  removeNode,
  repairMap,
  updateNode,
} from './graph';

const base = (): ConceptMap => {
  let map = createConceptMap('m1', 'teacher1', 'Дропки');
  map = addNode(map, { id: 'a', label: 'Дропка', x: 0, y: 0 });
  map = addNode(map, { id: 'b', label: 'Именител', x: 100, y: 0 });
  map = addNode(map, { id: 'c', label: 'Броител', x: 50, y: 90 });
  return addEdge(map, { id: 'e1', source: 'a', target: 'b', kind: 'relates' });
};

describe('addNode', () => {
  it('adds a node with empty attachments', () => {
    const map = addNode(createConceptMap('m', 'u', 'M'), { id: 'n', label: 'Поим', x: 1, y: 2 });

    expect(map.nodes).toHaveLength(1);
    expect(map.nodes[0]).toMatchObject({ id: 'n', label: 'Поим', x: 1, y: 2, taskIds: [], outcomeCodes: [] });
  });

  it('ignores a repeated id rather than creating a twin', () => {
    const once = addNode(createConceptMap('m', 'u', 'M'), { id: 'n', label: 'Прв', x: 0, y: 0 });
    const twice = addNode(once, { id: 'n', label: 'Втор', x: 9, y: 9 });

    expect(twice.nodes).toHaveLength(1);
    expect(twice.nodes[0].label).toBe('Прв');
  });

  it('falls back to a placeholder rather than an unlabelled circle', () => {
    const map = addNode(createConceptMap('m', 'u', 'M'), { id: 'n', label: '   ', x: 0, y: 0 });
    expect(map.nodes[0].label).toBe('Поим');
  });
});

describe('removeNode', () => {
  it('removes the edges that touched it', () => {
    // A dangling edge does not throw. It renders as a line to the origin, and
    // the map grows a connection the teacher never drew.
    const map = removeNode(base(), 'b');

    expect(map.nodes.map(n => n.id)).toEqual(['a', 'c']);
    expect(map.edges).toEqual([]);
    expect(findMapProblems(map)).toEqual([]);
  });

  it('leaves unrelated edges alone', () => {
    let map = addEdge(base(), { id: 'e2', source: 'a', target: 'c', kind: 'requires' });
    map = removeNode(map, 'b');

    expect(map.edges.map(e => e.id)).toEqual(['e2']);
  });

  it('is a no-op for an id that is not there', () => {
    const map = base();
    expect(removeNode(map, 'nope')).toBe(map);
  });
});

describe('addEdge', () => {
  it('refuses a loop on one node', () => {
    const map = base();
    expect(addEdge(map, { id: 'x', source: 'a', target: 'a', kind: 'relates' })).toBe(map);
  });

  it('refuses an endpoint that is not in the map', () => {
    const map = base();
    expect(addEdge(map, { id: 'x', source: 'a', target: 'ghost', kind: 'relates' })).toBe(map);
  });

  it('refuses a connection that already exists', () => {
    const map = base();
    expect(addEdge(map, { id: 'e2', source: 'a', target: 'b', kind: 'relates' })).toBe(map);
  });

  it('allows the same pair with a different meaning', () => {
    // "relates to" and "requires" are different statements about the same pair.
    const map = addEdge(base(), { id: 'e2', source: 'a', target: 'b', kind: 'requires' });
    expect(map.edges).toHaveLength(2);
  });

  it('treats direction as meaningful', () => {
    const map = addEdge(base(), { id: 'e2', source: 'b', target: 'a', kind: 'relates' });
    expect(map.edges).toHaveLength(2);
  });
});

describe('attachments', () => {
  it('attaches and detaches a task without repeating it', () => {
    let map = attachTask(base(), 'a', 't1');
    map = attachTask(map, 'a', 't1');

    expect(map.nodes.find(n => n.id === 'a')!.taskIds).toEqual(['t1']);
    expect(detachTask(map, 'a', 't1').nodes.find(n => n.id === 'a')!.taskIds).toEqual([]);
  });

  it('attaches an outcome only when a person asks', () => {
    // A concept map is the teacher's structure and the codes are the state's.
    // Nothing here derives a code from a label — contract §3.
    const map = attachOutcome(base(), 'a', 'МА.5.2.1');

    expect(map.nodes.find(n => n.id === 'a')!.outcomeCodes).toEqual(['МА.5.2.1']);
    expect(detachOutcome(map, 'a', 'МА.5.2.1').nodes.find(n => n.id === 'a')!.outcomeCodes).toEqual([]);
  });

  it('ignores a blank code and an unknown node', () => {
    const map = base();
    expect(attachOutcome(map, 'a', '   ')).toBe(map);
    expect(attachOutcome(map, 'ghost', 'МА.5.2.1')).toBe(map);
  });
});

describe('updateNode', () => {
  it('keeps the old label rather than accepting a blank one', () => {
    const map = updateNode(base(), 'a', { label: '   ' });
    expect(map.nodes.find(n => n.id === 'a')!.label).toBe('Дропка');
  });

  it('cannot change a node id', () => {
    const map = updateNode(base(), 'a', { label: 'Ново' } as never);
    expect(map.nodes.map(n => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('moves a node', () => {
    const map = updateNode(base(), 'a', { x: 42, y: 7 });
    expect(map.nodes.find(n => n.id === 'a')).toMatchObject({ x: 42, y: 7 });
  });
});

describe('every operation leaves the map sound', () => {
  it('holds through a long sequence of edits', () => {
    let map = base();
    map = addNode(map, { id: 'd', label: 'Мешан број', x: 200, y: 40 });
    map = addEdge(map, { id: 'e2', source: 'c', target: 'd', kind: 'requires' });
    map = addEdge(map, { id: 'e3', source: 'b', target: 'd', kind: 'relates' });
    map = attachTask(map, 'd', 't9');
    map = removeNode(map, 'b');
    map = removeEdge(map, 'e2');
    map = addEdge(map, { id: 'e4', source: 'a', target: 'd', kind: 'relates' });

    expect(findMapProblems(map)).toEqual([]);
    expect(map.nodes.map(n => n.id)).toEqual(['a', 'c', 'd']);
  });
});

describe('findMapProblems and repairMap', () => {
  const damaged = (): ConceptMap => ({
    ...base(),
    edges: [
      { id: 'e1', source: 'a', target: 'b', kind: 'relates' },
      { id: 'e2', source: 'a', target: 'ghost', kind: 'relates' },
      { id: 'e3', source: 'a', target: 'a', kind: 'relates' },
      { id: 'e4', source: 'a', target: 'b', kind: 'relates' },
    ],
  });

  it('names each kind of damage', () => {
    // A map can also arrive from Firestore, written by an older version or
    // edited elsewhere. Loading is where that should be noticed.
    expect(findMapProblems(damaged()).map(p => p.kind).sort())
      .toEqual(['dangling_edge', 'duplicate_edge', 'self_loop']);
  });

  it('opens a damaged map by dropping only what is broken', () => {
    // A teacher with a map that will not load has lost their work.
    const repaired = repairMap(damaged());

    expect(findMapProblems(repaired)).toEqual([]);
    expect(repaired.edges.map(e => e.id)).toEqual(['e1']);
    expect(repaired.nodes).toHaveLength(3);
  });

  it('is a no-op on a sound map', () => {
    const map = base();
    expect(repairMap(map).edges).toEqual(map.edges);
    expect(repairMap(map).nodes).toEqual(map.nodes);
  });

  it('survives a record missing the attachment arrays entirely', () => {
    const legacy = {
      ...base(),
      nodes: [{ id: 'a', label: 'Стар', x: 0, y: 0 } as never],
      edges: [],
    };

    expect(repairMap(legacy).nodes[0]).toMatchObject({ taskIds: [], outcomeCodes: [] });
  });
});

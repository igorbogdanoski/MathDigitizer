/**
 * The concept-map document and the operations on it
 * (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * `KnowledgeMapTab` already draws a graph, but it is derived: the nodes are a
 * task's `related_task_ids` and `prerequisite_task_ids`, and a teacher cannot
 * change anything. This is the editable version — a map the teacher authors,
 * which may point at tasks and outcomes but is not generated from them.
 *
 * Every operation is a pure function returning a new map, which is what makes
 * undo a matter of keeping the previous value rather than writing an inverse
 * for each edit.
 *
 * The invariant that has to hold after every operation: **no edge names a node
 * that is not in the map.** A dangling edge does not throw, it renders as a
 * line to coordinate zero, and the map silently grows a wrong connection.
 */

export type EdgeKind =
  /** A connects to B. */
  | 'relates'
  /** A must be understood before B. */
  | 'requires';

export interface ConceptNode {
  id: string;
  label: string;
  /** Free note shown when the node is selected. */
  note?: string;
  /** Position, kept so a teacher's arrangement survives a reload. */
  x: number;
  y: number;
  /** Tasks the teacher attached to this concept. */
  taskIds: string[];
  /**
   * БРО outcome codes the teacher attached.
   *
   * Only ever set by a person. A concept map is the teacher's own structure and
   * the codes are the state's; deriving the link from a label would be guessing
   * a curriculum claim from text, which contract §3 forbids.
   */
  outcomeCodes: string[];
}

export interface ConceptEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
}

export interface ConceptMap {
  id: string;
  title: string;
  ownerId: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  updatedAt: string;
}

export const MAX_LABEL_LENGTH = 120;

export function createConceptMap(id: string, ownerId: string, title: string): ConceptMap {
  return {
    id,
    ownerId,
    title: title.trim().slice(0, MAX_LABEL_LENGTH) || 'Нова мапа',
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

const touch = (map: ConceptMap, changes: Partial<ConceptMap>): ConceptMap => ({
  ...map,
  ...changes,
  updatedAt: new Date().toISOString(),
});

const clean = (value: string | undefined): string => (value ?? '').trim().slice(0, MAX_LABEL_LENGTH);

export function addNode(
  map: ConceptMap,
  node: { id: string; label: string; x: number; y: number; note?: string },
): ConceptMap {
  if (map.nodes.some(n => n.id === node.id)) return map;

  return touch(map, {
    nodes: [
      ...map.nodes,
      {
        id: node.id,
        label: clean(node.label) || 'Поим',
        note: node.note?.trim() || undefined,
        x: node.x,
        y: node.y,
        taskIds: [],
        outcomeCodes: [],
      },
    ],
  });
}

export function updateNode(
  map: ConceptMap,
  id: string,
  changes: Partial<Omit<ConceptNode, 'id'>>,
): ConceptMap {
  if (!map.nodes.some(n => n.id === id)) return map;

  return touch(map, {
    nodes: map.nodes.map(node =>
      node.id === id
        ? {
            ...node,
            ...changes,
            id: node.id,
            label: changes.label !== undefined ? clean(changes.label) || node.label : node.label,
          }
        : node,
    ),
  });
}

/**
 * Removes a node and every edge touching it.
 *
 * Removing the edges is not tidiness. An edge whose endpoint is gone renders as
 * a line to the origin, so the map gains a connection the teacher never drew
 * and nothing reports an error.
 */
export function removeNode(map: ConceptMap, id: string): ConceptMap {
  if (!map.nodes.some(n => n.id === id)) return map;

  return touch(map, {
    nodes: map.nodes.filter(node => node.id !== id),
    edges: map.edges.filter(edge => edge.source !== id && edge.target !== id),
  });
}

export interface AddEdgeInput {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
}

/**
 * Connects two nodes.
 *
 * Refused, returning the map unchanged, when the edge would be a loop on one
 * node, would name a node that is not there, or would repeat a connection that
 * already exists. Each is a no-op rather than an error because these arrive
 * from dragging, where the gesture is easy to make by accident.
 */
export function addEdge(map: ConceptMap, edge: AddEdgeInput): ConceptMap {
  if (edge.source === edge.target) return map;
  if (map.edges.some(e => e.id === edge.id)) return map;

  const ids = new Set(map.nodes.map(n => n.id));
  if (!ids.has(edge.source) || !ids.has(edge.target)) return map;

  const duplicate = map.edges.some(
    e => e.source === edge.source && e.target === edge.target && e.kind === edge.kind,
  );
  if (duplicate) return map;

  return touch(map, {
    edges: [
      ...map.edges,
      { id: edge.id, source: edge.source, target: edge.target, kind: edge.kind, label: clean(edge.label) || undefined },
    ],
  });
}

export function removeEdge(map: ConceptMap, id: string): ConceptMap {
  if (!map.edges.some(e => e.id === id)) return map;
  return touch(map, { edges: map.edges.filter(edge => edge.id !== id) });
}

/** Attaches a task to a concept, without repeating one already attached. */
export function attachTask(map: ConceptMap, nodeId: string, taskId: string): ConceptMap {
  const node = map.nodes.find(n => n.id === nodeId);
  if (!node || !taskId || node.taskIds.includes(taskId)) return map;
  return updateNode(map, nodeId, { taskIds: [...node.taskIds, taskId] });
}

export function detachTask(map: ConceptMap, nodeId: string, taskId: string): ConceptMap {
  const node = map.nodes.find(n => n.id === nodeId);
  if (!node || !node.taskIds.includes(taskId)) return map;
  return updateNode(map, nodeId, { taskIds: node.taskIds.filter(id => id !== taskId) });
}

/** Attaches a БРО outcome. Only ever called from a teacher's explicit choice. */
export function attachOutcome(map: ConceptMap, nodeId: string, code: string): ConceptMap {
  const node = map.nodes.find(n => n.id === nodeId);
  const trimmed = code.trim();
  if (!node || !trimmed || node.outcomeCodes.includes(trimmed)) return map;
  return updateNode(map, nodeId, { outcomeCodes: [...node.outcomeCodes, trimmed] });
}

export function detachOutcome(map: ConceptMap, nodeId: string, code: string): ConceptMap {
  const node = map.nodes.find(n => n.id === nodeId);
  if (!node || !node.outcomeCodes.includes(code)) return map;
  return updateNode(map, nodeId, { outcomeCodes: node.outcomeCodes.filter(c => c !== code) });
}

export interface MapProblem {
  kind: 'dangling_edge' | 'duplicate_node' | 'duplicate_edge' | 'self_loop';
  detail: string;
}

/**
 * Checks the invariants the operations above maintain.
 *
 * Exported because a map can also arrive from Firestore, where it was written
 * by an older version of this code or edited elsewhere. Loading is where a
 * broken map should be noticed, not the render.
 */
export function findMapProblems(map: ConceptMap): MapProblem[] {
  const problems: MapProblem[] = [];
  const ids = new Set<string>();

  for (const node of map.nodes) {
    if (ids.has(node.id)) problems.push({ kind: 'duplicate_node', detail: node.id });
    ids.add(node.id);
  }

  const seenEdges = new Set<string>();
  for (const edge of map.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      problems.push({ kind: 'dangling_edge', detail: `${edge.source}→${edge.target}` });
    }
    if (edge.source === edge.target) {
      problems.push({ kind: 'self_loop', detail: edge.source });
    }
    const key = `${edge.source}|${edge.target}|${edge.kind}`;
    if (seenEdges.has(key)) problems.push({ kind: 'duplicate_edge', detail: key });
    seenEdges.add(key);
  }

  return problems;
}

/**
 * Drops whatever breaks the invariants, so a damaged map still opens.
 *
 * A teacher with a map that will not load has lost their work; a teacher with a
 * map missing one bad edge has lost one edge and can see which.
 */
export function repairMap(map: ConceptMap): ConceptMap {
  const nodes: ConceptNode[] = [];
  const seenNodes = new Set<string>();
  for (const node of map.nodes) {
    if (seenNodes.has(node.id)) continue;
    seenNodes.add(node.id);
    nodes.push({ ...node, taskIds: node.taskIds ?? [], outcomeCodes: node.outcomeCodes ?? [] });
  }

  const edges: ConceptEdge[] = [];
  const seenEdges = new Set<string>();
  for (const edge of map.edges) {
    if (!seenNodes.has(edge.source) || !seenNodes.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    const key = `${edge.source}|${edge.target}|${edge.kind}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push(edge);
  }

  return { ...map, nodes, edges };
}

/**
 * One-shot arrangement for a concept map (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * `KnowledgeMapTab` runs a live d3 force simulation, which suits it: that graph
 * is derived and nobody positions anything. An editable map is the opposite
 * case — a teacher puts "Дропка" above "Именител" because that is how they
 * explain it, and a running simulation pulls it back out again. Continuous
 * force layout and deliberate placement are not compatible, and the placement
 * is the part that carries meaning.
 *
 * So the force layout is an action, not a mode: it runs when asked, settles,
 * and hands back coordinates the teacher then owns and can drag.
 */
import { ConceptMap, ConceptNode } from './graph';

export interface LayoutOptions {
  width?: number;
  height?: number;
  /** Simulation ticks. More is tidier and slower; 300 settles a school-sized map. */
  iterations?: number;
}

/**
 * Returns the map with new coordinates.
 *
 * Deliberately synchronous and dependency-light: d3-force is imported lazily by
 * the component that offers the button, and this stays testable without it.
 * The algorithm is a small spring/repulsion relaxation — enough for the dozens
 * of nodes a concept map holds, and it never needs to scale beyond that.
 */
export function arrangeMap(map: ConceptMap, options: LayoutOptions = {}): ConceptMap {
  const width = options.width ?? 900;
  const height = options.height ?? 600;
  const iterations = options.iterations ?? 300;

  if (map.nodes.length === 0) return map;
  if (map.nodes.length === 1) {
    return { ...map, nodes: [{ ...map.nodes[0], x: width / 2, y: height / 2 }] };
  }

  // Start on a circle rather than at random: the same map always arranges the
  // same way, so pressing the button twice does not shuffle a teacher's work
  // into something unrecognisable.
  const radius = Math.min(width, height) / 3;
  const positions = new Map<string, { x: number; y: number }>(
    map.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / map.nodes.length;
      return [node.id, { x: width / 2 + radius * Math.cos(angle), y: height / 2 + radius * Math.sin(angle) }];
    }),
  );

  const IDEAL_EDGE = 150;
  const REPULSION = 60000;

  for (let step = 0; step < iterations; step++) {
    const cooling = 1 - step / iterations;
    const forces = new Map<string, { x: number; y: number }>(
      map.nodes.map(node => [node.id, { x: 0, y: 0 }]),
    );

    // Every pair pushes apart, so nodes do not pile up.
    for (let i = 0; i < map.nodes.length; i++) {
      for (let j = i + 1; j < map.nodes.length; j++) {
        const a = positions.get(map.nodes[i].id)!;
        const b = positions.get(map.nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.hypot(dx, dy);

        // Two nodes at the same point have no direction to separate along;
        // nudge them apart deterministically rather than dividing by zero.
        if (distance < 0.01) {
          dx = (i - j) || 1;
          dy = 1;
          distance = Math.hypot(dx, dy);
        }

        const push = REPULSION / (distance * distance);
        const fx = (dx / distance) * push;
        const fy = (dy / distance) * push;

        forces.get(map.nodes[i].id)!.x += fx;
        forces.get(map.nodes[i].id)!.y += fy;
        forces.get(map.nodes[j].id)!.x -= fx;
        forces.get(map.nodes[j].id)!.y -= fy;
      }
    }

    // Connected nodes pull together.
    for (const edge of map.edges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const pull = (distance - IDEAL_EDGE) * 0.05;

      const fx = (dx / distance) * pull;
      const fy = (dy / distance) * pull;

      forces.get(edge.source)!.x += fx;
      forces.get(edge.source)!.y += fy;
      forces.get(edge.target)!.x -= fx;
      forces.get(edge.target)!.y -= fy;
    }

    for (const node of map.nodes) {
      const force = forces.get(node.id)!;
      const position = positions.get(node.id)!;
      // Cap the step so one crowded pair cannot fling a node off the canvas.
      const step = Math.min(30, Math.hypot(force.x, force.y));
      const magnitude = Math.max(0.01, Math.hypot(force.x, force.y));

      position.x += (force.x / magnitude) * step * cooling;
      position.y += (force.y / magnitude) * step * cooling;
    }
  }

  const nodes: ConceptNode[] = map.nodes.map(node => {
    const position = positions.get(node.id)!;
    return { ...node, x: Math.round(position.x), y: Math.round(position.y) };
  });

  return { ...map, nodes };
}

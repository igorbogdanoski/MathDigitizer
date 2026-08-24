/**
 * DEV-only probe for the concept map editor
 * (EXPERT_LEVEL_MASTER_PLAN, 12).
 *
 * The editor lives behind auth, and the pattern this project already uses for
 * e2e on gated UI is a probe route rather than a test login — see
 * `/__e2e__/ink-pipeline` and `/__e2e__/letterhead`. The fixture is fixed on
 * purpose: an e2e assertion against generated content tests the generator, not
 * the screen.
 */
import React, { useState } from 'react';
import ConceptMapEditor from '../mindmap/ConceptMapEditor';
import { ConceptMap, addEdge, addNode, createConceptMap } from '../../lib/mindmap/graph';

const fixture = (): ConceptMap => {
  let map = createConceptMap('probe', 'e2e', 'Дропки');
  map = addNode(map, { id: 'a', label: 'Дропка', x: 160, y: 140 });
  map = addNode(map, { id: 'b', label: 'Именител', x: 380, y: 140 });
  map = addNode(map, { id: 'c', label: 'Броител', x: 270, y: 300 });
  map = addEdge(map, { id: 'e1', source: 'a', target: 'b', kind: 'relates' });
  return addEdge(map, { id: 'e2', source: 'c', target: 'a', kind: 'requires' });
};

export const ConceptMapProbe: React.FC = () => {
  const [map, setMap] = useState<ConceptMap>(fixture);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Concept map probe</h1>

      <ConceptMapEditor map={map} onChange={setMap} />

      {/* Machine-readable state, so an assertion does not depend on layout. */}
      <output data-testid="map-state" className="sr-only">
        {JSON.stringify({ nodes: map.nodes.length, edges: map.edges.length })}
      </output>
    </main>
  );
};

export default ConceptMapProbe;

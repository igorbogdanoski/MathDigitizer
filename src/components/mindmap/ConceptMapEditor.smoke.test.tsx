import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConceptMapEditor from './ConceptMapEditor';
import { ConceptMap, addEdge, addNode, createConceptMap } from '../../lib/mindmap/graph';

// i18n resolves to English in tests; match either language so the assertions
// describe behaviour rather than one locale's wording.
const ADD = /Додај поим|Add concept|Shto koncept/;
const ARRANGE = /Подреди|Arrange|Rendit/;
const UNDO = /Врати|Undo|Zhbëj/;
const DELETE_NODE = /Избриши поим|Delete concept|Fshi konceptin/;

const seeded = (): ConceptMap => {
  let map = createConceptMap('m1', 'teacher1', 'Дропки');
  map = addNode(map, { id: 'a', label: 'Дропка', x: 100, y: 100 });
  map = addNode(map, { id: 'b', label: 'Именител', x: 260, y: 100 });
  return addEdge(map, { id: 'e1', source: 'a', target: 'b', kind: 'relates' });
};

/** Hosts the editor with the state it expects a parent to own. */
const Harness: React.FC<{ initial?: ConceptMap; editable?: boolean }> = ({
  initial = seeded(),
  editable = true,
}) => {
  const [map, setMap] = useState(initial);
  return (
    <>
      <ConceptMapEditor map={map} onChange={setMap} editable={editable} />
      <output data-testid="counts">{`${map.nodes.length}/${map.edges.length}`}</output>
    </>
  );
};

describe('ConceptMapEditor', () => {
  it('draws the concepts and the links between them', () => {
    render(<Harness />);

    expect(screen.getByText('Дропка')).toBeInTheDocument();
    expect(screen.getByText('Именител')).toBeInTheDocument();
    expect(screen.getByTestId('counts')).toHaveTextContent('2/1');
  });

  it('adds a concept', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ADD }));

    expect(screen.getByTestId('counts')).toHaveTextContent('3/1');
  });

  it('removes the links along with the concept they touched', () => {
    // A dangling edge renders as a line to the origin: the map would gain a
    // connection the teacher never drew.
    render(<Harness />);

    fireEvent.click(screen.getByText('Именител'));
    fireEvent.click(screen.getByRole('button', { name: DELETE_NODE }));

    expect(screen.getByTestId('counts')).toHaveTextContent('1/0');
  });

  it('undoes the last edit', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: ADD }));
    expect(screen.getByTestId('counts')).toHaveTextContent('3/1');

    fireEvent.click(screen.getByRole('button', { name: UNDO }));
    expect(screen.getByTestId('counts')).toHaveTextContent('2/1');
  });

  it('has nothing to undo before the first edit', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: UNDO })).toBeDisabled();
  });

  it('arranges without changing what is on the map', () => {
    // The layout is an action, not a mode: it moves nodes and touches nothing
    // else, so a teacher's structure survives pressing it.
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: ARRANGE }));

    expect(screen.getByTestId('counts')).toHaveTextContent('2/1');
    expect(screen.getByText('Дропка')).toBeInTheDocument();
  });

  it('renames a concept through the label field', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('Дропка'));
    fireEvent.change(screen.getByLabelText(/Назив|Label|Emërtimi/), { target: { value: 'Разломок' } });

    expect(screen.getByText('Разломок')).toBeInTheDocument();
  });

  it('offers no tools at all when it is not editable', () => {
    render(<Harness editable={false} />);

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.getByText('Дропка')).toBeInTheDocument();
  });

  it('names the canvas for a screen reader', () => {
    render(<Harness />);
    expect(screen.getByRole('application', { name: /Дропки/ })).toBeInTheDocument();
  });

  it('renders an empty map without falling over', () => {
    render(<Harness initial={createConceptMap('m', 'u', 'Празна')} />);
    expect(screen.getByTestId('counts')).toHaveTextContent('0/0');
  });
});

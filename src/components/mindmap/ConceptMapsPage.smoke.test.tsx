import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { listMaps, saveMap, deleteMap } = vi.hoisted(() => ({
  listMaps: vi.fn(),
  saveMap: vi.fn(),
  deleteMap: vi.fn(),
}));

vi.mock('@/src/lib/mindmap/store', () => ({
  listConceptMaps: listMaps,
  saveConceptMap: saveMap,
  deleteConceptMap: deleteMap,
  CONCEPT_MAP_COLLECTION: 'concept_maps',
}));
vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'teacher1' }, userProfile: { role: 'teacher' } }),
}));
vi.mock('@/src/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { ConceptMapsPage } from './ConceptMapsPage';
import { addNode, createConceptMap } from '../../lib/mindmap/graph';

const NEW_MAP = /Нова мапа|New map|Hartë e re/;

const existing = () => {
  const map = createConceptMap('cm1', 'teacher1', 'Дропки');
  return [addNode(map, { id: 'a', label: 'Дропка', x: 10, y: 10 })];
};

/**
 * Phase 11's editor and store were written and tested before this screen
 * existed, which meant a teacher could not reach any of it. These assert the
 * part that was missing: that the list, the editor and the save actually
 * connect.
 */
describe('ConceptMapsPage', () => {
  beforeEach(() => {
    listMaps.mockReset().mockResolvedValue([]);
    saveMap.mockReset().mockResolvedValue(undefined);
    deleteMap.mockReset().mockResolvedValue(undefined);
  });

  it('invites the teacher to start when they have no maps', async () => {
    render(<ConceptMapsPage />);
    await waitFor(() => expect(listMaps).toHaveBeenCalledWith('teacher1'));

    expect(await screen.findByText(/Сè уште немате мапа|No maps yet|Ende asnjë hartë/)).toBeInTheDocument();
  });

  it('lists the maps the teacher has, with what is in them', async () => {
    listMaps.mockResolvedValue(existing());
    render(<ConceptMapsPage />);

    expect(await screen.findByText('Дропки')).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('persists a new map rather than only holding it in memory', async () => {
    render(<ConceptMapsPage />);
    fireEvent.click(await screen.findByRole('button', { name: NEW_MAP }));

    await waitFor(() => expect(saveMap).toHaveBeenCalledTimes(1));
    expect(saveMap.mock.calls[0][0]).toMatchObject({ ownerId: 'teacher1' });
  });

  it('opens the editor on the map that was clicked', async () => {
    listMaps.mockResolvedValue(existing());
    render(<ConceptMapsPage />);

    fireEvent.click(await screen.findByText('Дропки'));

    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByRole('application', { name: /Дропки/ })).toBeInTheDocument();
  });

  it('saves the edited map through the store', async () => {
    listMaps.mockResolvedValue(existing());
    render(<ConceptMapsPage />);
    fireEvent.click(await screen.findByText('Дропки'));

    const save = await screen.findByRole('button', { name: /Зачувај|Save|Ruaj/ });
    fireEvent.click(save);

    await waitFor(() => expect(saveMap).toHaveBeenCalled());
  });
});

/**
 * Where concept maps live (EXPERT_LEVEL_MASTER_PLAN, 11.1).
 *
 * A map is one document: unlike a distilled textbook, it is small, always read
 * whole, and edited as a unit — splitting it per node would turn one save into
 * a fan of writes that can half-fail and leave the map inconsistent.
 *
 * Everything read back goes through `repairMap`, because a document can have
 * been written by an older version of this code. A teacher whose map will not
 * open has lost their work; one whose map lost a single bad edge has lost an
 * edge and can see which.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ConceptMap, repairMap } from './graph';

export const CONCEPT_MAP_COLLECTION = 'concept_maps';

export async function saveConceptMap(map: ConceptMap): Promise<void> {
  await setDoc(doc(db, CONCEPT_MAP_COLLECTION, map.id), {
    ...map,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadConceptMap(id: string): Promise<ConceptMap | null> {
  try {
    const snap = await getDoc(doc(db, CONCEPT_MAP_COLLECTION, id));
    if (!snap.exists()) return null;
    return repairMap({ ...(snap.data() as ConceptMap), id: snap.id });
  } catch {
    return null;
  }
}

export async function listConceptMaps(ownerId: string): Promise<ConceptMap[]> {
  try {
    const snap = await getDocs(
      query(collection(db, CONCEPT_MAP_COLLECTION), where('ownerId', '==', ownerId)),
    );
    return snap.docs
      .map(entry => repairMap({ ...(entry.data() as ConceptMap), id: entry.id }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function deleteConceptMap(id: string): Promise<void> {
  await deleteDoc(doc(db, CONCEPT_MAP_COLLECTION, id));
}

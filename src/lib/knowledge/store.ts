/**
 * The `knowledge_skills` collection — distilled textbooks
 * (EXPERT_LEVEL_MASTER_PLAN, 10.1).
 *
 * One document per distilled chapter, keyed by book. Chapters are stored
 * separately rather than as one document per book for the reason book-to-skill
 * writes one file per chapter: retrieval loads the chapter it needs, and a
 * 300-page book held in one document would be fetched whole every time.
 *
 * Every record carries the right-to-use declaration that permitted it. If a
 * publisher asks, the answer is a record naming a person and a date — not a
 * checkbox somebody clicked once.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ChapterSkill } from './skillSchema';
import { UsageDeclaration } from './usageRights';

export const KNOWLEDGE_COLLECTION = 'knowledge_skills';

export interface StoredChapterSkill extends ChapterSkill {
  id?: string;
  /** Stable id for the book this chapter came from. */
  bookId: string;
  bookTitle: string;
  /** The teacher who imported it. Queries are scoped to this. */
  ownerId: string;
  usage: UsageDeclaration;
  createdAt: string;
  /**
   * Outcome codes a teacher has linked this chapter to.
   *
   * Empty until someone does. The chapter is the author's and the codes are the
   * state's; joining them is a claim about the curriculum, and contract §3
   * forbids inferring it from text.
   */
  outcomeCodes: string[];
}

/** A book identifier that stays the same when the same file is re-imported. */
export function bookIdFor(ownerId: string, bookTitle: string): string {
  const slug = bookTitle
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 60);
  return `${ownerId}:${slug || 'book'}`;
}

export async function saveChapterSkills(
  skills: readonly StoredChapterSkill[],
): Promise<number> {
  let written = 0;
  for (const skill of skills) {
    await addDoc(collection(db, KNOWLEDGE_COLLECTION), skill);
    written++;
  }
  return written;
}

/** Every distilled chapter a teacher has, newest book first. */
export async function getChapterSkills(ownerId: string): Promise<StoredChapterSkill[]> {
  try {
    const snap = await getDocs(
      query(collection(db, KNOWLEDGE_COLLECTION), where('ownerId', '==', ownerId)),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredChapterSkill));
  } catch {
    return [];
  }
}

export async function deleteBook(ownerId: string, bookId: string): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, KNOWLEDGE_COLLECTION),
      where('ownerId', '==', ownerId),
      where('bookId', '==', bookId),
    ),
  );

  for (const entry of snap.docs) {
    await deleteDoc(doc(db, KNOWLEDGE_COLLECTION, entry.id));
  }
  return snap.size;
}

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
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
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

/**
 * Firestore's limit on operations in one batch.
 *
 * A textbook of more than 500 chapters would need more than one batch, and each
 * batch is atomic only within itself. No book seen so far comes close, but the
 * chunking is here so that one that does is written in whole batches rather
 * than failing.
 */
const BATCH_LIMIT = 500;

/**
 * Stores a distilled book.
 *
 * Written in batches rather than one document at a time. Speed is the smaller
 * reason: forty chapters used to be forty sequential round trips. The one that
 * matters is atomicity — a loop that failed on the twentieth chapter left
 * nineteen in the knowledge base with nothing to say the book was incomplete,
 * and retrieval would then answer from half a textbook without anything looking
 * wrong.
 */
export async function saveChapterSkills(
  skills: readonly StoredChapterSkill[],
): Promise<number> {
  const target = collection(db, KNOWLEDGE_COLLECTION);

  for (let start = 0; start < skills.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const skill of skills.slice(start, start + BATCH_LIMIT)) {
      batch.set(doc(target), skill);
    }
    await batch.commit();
  }

  return skills.length;
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

  // Batched for the same reason as the write: a deletion that stops halfway
  // leaves a book that is partly gone, which reads as a smaller book rather
  // than as a failure.
  for (let start = 0; start < snap.docs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const entry of snap.docs.slice(start, start + BATCH_LIMIT)) {
      batch.delete(doc(db, KNOWLEDGE_COLLECTION, entry.id));
    }
    await batch.commit();
  }

  return snap.size;
}

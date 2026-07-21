/**
 * Firestore Security Rules Unit Tests
 * 
 * These tests require the Firebase emulator to be running.
 * They are excluded from the regular `npm run test` run.
 * 
 * To run these tests:
 *   firebase emulators:exec --only firestore "npx vitest --run src/lib/firestore.rules.test.ts"
 * 
 * Or add to CI workflow:
 *   - name: Run Firestore rules tests
 *     run: firebase emulators:exec --only firestore "npm run test -- --run src/lib/firestore.rules.test.ts"
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: 'mathdigitizer-test',
    firestore: { rules },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore Security Rules', () => {
  describe('users collection', () => {
    it('should allow a user to create their own profile without isPro', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const ref = doc(alice.firestore(), 'users', 'alice');
      await assertSucceeds(
        setDoc(ref, {
          uid: 'alice',
          email: 'alice@test.com',
          displayName: 'Alice',
          role: 'teacher',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
      );
    });

    it('should DENY a user from self-granting isPro on create', async () => {
      const mallory = testEnv.authenticatedContext('mallory');
      const ref = doc(mallory.firestore(), 'users', 'mallory');
      await assertFails(
        setDoc(ref, {
          uid: 'mallory',
          email: 'mallory@test.com',
          displayName: 'Mallory',
          role: 'teacher',
          createdAt: '2026-01-01T00:00:00.000Z',
          isPro: true,
        })
      );
    });

    it('should DENY a user from changing their own role on update', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const ref = doc(alice.firestore(), 'users', 'alice');
      // First create the profile
      await setDoc(ref, {
        uid: 'alice',
        email: 'alice@test.com',
        displayName: 'Alice',
        role: 'student',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      // Try to escalate to teacher
      await assertFails(
        updateDoc(ref, { role: 'teacher' })
      );
    });

    it('should DENY a user from self-granting isPro on update', async () => {
      const alice = testEnv.authenticatedContext('alice');
      const ref = doc(alice.firestore(), 'users', 'alice');
      await setDoc(ref, {
        uid: 'alice',
        email: 'alice@test.com',
        displayName: 'Alice',
        role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await assertFails(updateDoc(ref, { isPro: true }));
    });

    it('should DENY a student from reading another user profile', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'users', 'alice');
      await assertFails(getDoc(ref));
    });

    it('should ALLOW a teacher to read another user profile', async () => {
      // First make alice a teacher
      const alice = testEnv.authenticatedContext('alice');
      await setDoc(doc(alice.firestore(), 'users', 'alice'), {
        uid: 'alice',
        email: 'alice@test.com',
        displayName: 'Alice',
        role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const ref = doc(alice.firestore(), 'users', 'student1');
      await assertSucceeds(getDoc(ref));
    });
  });

  describe('active_user_sessions collection', () => {
    it('should ALLOW a user to create their own session', async () => {
      const user = testEnv.authenticatedContext('solver1');
      const ref = doc(user.firestore(), 'active_user_sessions', 'session1');
      await assertSucceeds(
        setDoc(ref, {
          userId: 'solver1',
          taskId: 'task1',
          startedAt: '2026-01-01T00:00:00.000Z',
        })
      );
    });

    it('should DENY a student from reading active sessions', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'active_user_sessions', 'session1');
      await assertFails(getDoc(ref));
    });

    it('should ALLOW a teacher to read active sessions', async () => {
      const teacher = testEnv.authenticatedContext('teacher1');
      await setDoc(doc(teacher.firestore(), 'users', 'teacher1'), {
        uid: 'teacher1',
        email: 'teacher@test.com',
        displayName: 'Teacher',
        role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const ref = doc(teacher.firestore(), 'active_user_sessions', 'session1');
      await assertSucceeds(getDoc(ref));
    });
  });

  describe('task_attempts collection', () => {
    it('should ALLOW a student to create their own attempt', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'task_attempts', 'attempt1');
      await assertSucceeds(
        setDoc(ref, {
          user_id: 'student1',
          task_id: 'task1',
          startedAt: '2026-01-01T00:00:00.000Z',
        })
      );
    });

    it('should DENY updating a task_attempt (write-once)', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'task_attempts', 'attempt1');
      await setDoc(ref, {
        user_id: 'student1',
        task_id: 'task1',
        startedAt: '2026-01-01T00:00:00.000Z',
      });
      await assertFails(updateDoc(ref, { score: 100 }));
    });

    it('should DENY a student from reading another student attempt', async () => {
      const student2 = testEnv.authenticatedContext('student2');
      const ref = doc(student2.firestore(), 'task_attempts', 'attempt1');
      await assertFails(getDoc(ref));
    });
  });

  describe('assignments collection', () => {
    it('should DENY a non-teacher from creating an assignment', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'assignments', 'assign1');
      await assertFails(
        setDoc(ref, {
          classroomId: 'class1',
          title: 'Homework',
          dueDate: '2026-02-01T00:00:00.000Z',
        })
      );
    });
  });

  describe('live_sessions collection', () => {
    it('should ALLOW a teacher to create a live session', async () => {
      const teacher = testEnv.authenticatedContext('teacher1');
      await setDoc(doc(teacher.firestore(), 'users', 'teacher1'), {
        uid: 'teacher1',
        email: 'teacher@test.com',
        displayName: 'Teacher',
        role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const ref = doc(teacher.firestore(), 'live_sessions', 'PIN123');
      await assertSucceeds(
        setDoc(ref, {
          teacher_uid: 'teacher1',
          quiz_data: { questions: [] },
          status: 'waiting',
          current_question_index: 0,
        })
      );
    });

    it('should DENY a student from modifying quiz_data', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'live_sessions', 'PIN123');
      await assertFails(
        updateDoc(ref, { quiz_data: { questions: ['hacked'] } })
      );
    });

    it('should ALLOW a student to join (modify participants only)', async () => {
      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'live_sessions', 'PIN123');
      await assertSucceeds(
        updateDoc(ref, {
          participants: { student1: { name: 'Student', joinedAt: '2026-01-01T00:00:00.000Z' } },
        })
      );
    });
  });

  describe('whiteboard_sessions collection', () => {
    it('should DENY a user from updating another user whiteboard', async () => {
      const user1 = testEnv.authenticatedContext('user1');
      await setDoc(doc(user1.firestore(), 'whiteboard_sessions', 'wb1'), {
        authorId: 'user1',
        data: { strokes: [] },
      });
      const user2 = testEnv.authenticatedContext('user2');
      const ref = doc(user2.firestore(), 'whiteboard_sessions', 'wb1');
      await assertFails(updateDoc(ref, { data: { strokes: ['hacked'] } }));
    });
  });
});

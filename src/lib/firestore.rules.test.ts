/**
 * Firestore Security Rules Unit Tests
 *
 * These need the Firestore emulator (which needs Java), so they are excluded
 * from the default vitest run and have their own config and script:
 *
 *   npm run test:rules
 *
 * That starts the emulator, runs this file through vitest.rules.config.ts and
 * shuts the emulator down again.
 *
 * Every test starts from an empty database (see the beforeEach below). Seed any
 * document the test does not itself assert on via
 * `testEnv.withSecurityRulesDisabled`, so a failing setup can never masquerade
 * as a passing security assertion.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
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

// Without this, documents written by one test leak into the next, and a
// `create` in the follow-up test is evaluated as an `update` of the leftover
// document — which the rules (correctly) deny, failing the wrong assertion.
beforeEach(async () => {
  await testEnv.clearFirestore();
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
      // Seed the session outside the rules — the setup is not what is asserted.
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'live_sessions', 'PIN123'), {
          teacher_uid: 'teacher1',
          quiz_data: { questions: [] },
          status: 'waiting',
          current_question_index: 0,
        });
      });

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

  // ── Intervention plans (EXPERT_LEVEL_MASTER_PLAN, 7.3) ────────────────────
  describe('intervention_plans collection', () => {
    const asTeacher = async (uid = 'teacher1') => {
      const teacher = testEnv.authenticatedContext(uid);
      await setDoc(doc(teacher.firestore(), 'users', uid), {
        uid, email: `${uid}@test.com`, displayName: 'Teacher', role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      return teacher;
    };

    const plan = (over: Record<string, unknown> = {}) => ({
      student_id: 'student1',
      teacher_uid: 'teacher1',
      reason: 'Геометрија',
      action: 'Основни конструкции',
      kind: 'targeted_tasks',
      created_at: '2026-08-23T10:00:00.000Z',
      ...over,
    });

    it('should ALLOW a teacher to assign a plan under their own uid', async () => {
      const teacher = await asTeacher();
      await assertSucceeds(setDoc(doc(teacher.firestore(), 'intervention_plans', 'p1'), plan()));
    });

    it('should DENY assigning a plan under another teacher uid', async () => {
      const teacher = await asTeacher();
      await assertFails(
        setDoc(doc(teacher.firestore(), 'intervention_plans', 'p2'), plan({ teacher_uid: 'someone-else' }))
      );
    });

    it('should DENY a student from creating a plan for themselves', async () => {
      const student = testEnv.authenticatedContext('student1');
      await assertFails(
        setDoc(doc(student.firestore(), 'intervention_plans', 'p3'), plan({ teacher_uid: 'student1' }))
      );
    });

    it('should ALLOW the student it is about to read it', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'intervention_plans', 'p4'), plan());
      });

      const student = testEnv.authenticatedContext('student1');
      await assertSucceeds(getDoc(doc(student.firestore(), 'intervention_plans', 'p4')));
    });

    it('should DENY an unrelated student from reading it', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'intervention_plans', 'p5'), plan());
      });

      const other = testEnv.authenticatedContext('student2');
      await assertFails(getDoc(doc(other.firestore(), 'intervention_plans', 'p5')));
    });

    it('should ALLOW the author to resolve it, but not rewrite who it is about', async () => {
      const teacher = await asTeacher();
      await setDoc(doc(teacher.firestore(), 'intervention_plans', 'p6'), plan());

      const ref = doc(teacher.firestore(), 'intervention_plans', 'p6');
      await assertSucceeds(updateDoc(ref, { resolved_at: '2026-08-30T10:00:00.000Z' }));
      await assertFails(updateDoc(ref, { student_id: 'someone-else' }));
    });
  });

  // ── Exam window enforcement (EXPERT_LEVEL_MASTER_PLAN, 5.3) ───────────────
  describe('knowledge_skills collection', () => {
    const asTeacher = async (uid: string) => {
      const teacher = testEnv.authenticatedContext(uid);
      await setDoc(doc(teacher.firestore(), 'users', uid), {
        uid, email: `${uid}@test.com`, displayName: 'Teacher', role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      return teacher;
    };

    const skill = (over: Record<string, unknown> = {}) => ({
      ownerId: 'teacher1',
      bookId: 'teacher1:matematika-5',
      bookTitle: 'Математика 5',
      chapterIndex: 0,
      chapterTitle: 'Дропки',
      coreIdea: 'Дропките се делови од целина.',
      concepts: [], methods: [], misconceptions: [],
      workedExample: '', takeaways: [], outcomeCodes: [],
      createdAt: '2026-08-25T10:00:00.000Z',
      usage: {
        basis: 'own_work',
        declaredBy: 'teacher1',
        declaredAt: '2026-08-25T10:00:00.000Z',
      },
      ...over,
    });

    it('should ALLOW a teacher to store a chapter they distilled', async () => {
      const teacher = await asTeacher('teacher1');
      await assertSucceeds(setDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), skill()));
    });

    it('should DENY storing a chapter without a right-to-use declaration', async () => {
      // Distillation keeps a derived copy of somebody's book. A record with no
      // declaration cannot answer for why it exists.
      const teacher = await asTeacher('teacher1');
      const { usage, ...withoutUsage } = skill();
      await assertFails(setDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), withoutUsage));
    });

    it('should DENY a declaration made in another teacher name', async () => {
      const teacher = await asTeacher('teacher1');
      await assertFails(setDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), skill({
        usage: { basis: 'own_work', declaredBy: 'teacher2', declaredAt: '2026-08-25T10:00:00.000Z' },
      })));
    });

    it('should DENY storing a chapter under another teacher uid', async () => {
      const teacher = await asTeacher('teacher1');
      await assertFails(setDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), skill({
        ownerId: 'teacher2',
      })));
    });

    it('should DENY another teacher reading it', async () => {
      // The declared right covers their own teaching, not redistribution.
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'knowledge_skills', 'k1'), skill());
      });

      const other = await asTeacher('teacher2');
      await assertFails(getDoc(doc(other.firestore(), 'knowledge_skills', 'k1')));
    });

    it('should ALLOW the owner to link curriculum outcomes to it', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'knowledge_skills', 'k1'), skill());
      });

      const teacher = await asTeacher('teacher1');
      await assertSucceeds(updateDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), {
        outcomeCodes: ['МА.5.2.1'],
      }));
    });

    it('should DENY rewriting the distilled content or the declaration', async () => {
      // What the model produced, and what permitted producing it, are what they
      // were when the record was written.
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'knowledge_skills', 'k1'), skill());
      });

      const teacher = await asTeacher('teacher1');
      await assertFails(updateDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), {
        coreIdea: 'нешто друго',
      }));
      await assertFails(updateDoc(doc(teacher.firestore(), 'knowledge_skills', 'k1'), {
        usage: { basis: 'public_domain', declaredBy: 'teacher1', declaredAt: '2026-08-25T10:00:00.000Z' },
      }));
    });
  });

  describe('summative_attempts collection', () => {
    const HOUR = 60 * 60 * 1000;

    /**
     * Seeds an exam outside the rules. `opens_at` / `due_at` are epoch
     * milliseconds, because Firestore rules cannot parse ISO date strings.
     */
    const seedExam = async (id: string, data: Record<string, unknown>) => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'summative_exams', id), {
          teacher_uid: 'teacher1',
          test_data: { title: 'Тест', questions: [] },
          created_at: Date.now(),
          ...data,
        });
      });
    };

    const submit = (examId: string, uid = 'student1') => {
      const student = testEnv.authenticatedContext(uid);
      return setDoc(doc(student.firestore(), 'summative_attempts', `${examId}_${uid}`), {
        id: `${examId}_${uid}`,
        exam_id: examId,
        student_name: 'Student',
        student_uid: uid,
        answers: { 0: 'x=2' },
        submitted_at: Date.now(),
      });
    };

    it('should ALLOW submitting to an open exam with no window set', async () => {
      await seedExam('open-no-window', { status: 'open' });
      await assertSucceeds(submit('open-no-window'));
    });

    it('should ALLOW submitting inside the exam window', async () => {
      await seedExam('open-in-window', {
        status: 'open',
        opens_at: Date.now() - HOUR,
        due_at: Date.now() + HOUR,
      });
      await assertSucceeds(submit('open-in-window'));
    });

    it('should DENY submitting to a closed exam', async () => {
      await seedExam('closed-exam', { status: 'closed' });
      await assertFails(submit('closed-exam'));
    });

    it('should DENY submitting after the deadline', async () => {
      await seedExam('past-due', { status: 'open', due_at: Date.now() - HOUR });
      await assertFails(submit('past-due'));
    });

    it('should DENY submitting before the exam opens', async () => {
      await seedExam('not-yet-open', { status: 'open', opens_at: Date.now() + HOUR });
      await assertFails(submit('not-yet-open'));
    });

    it('should DENY submitting under another student uid', async () => {
      await seedExam('impersonation', { status: 'open' });
      const mallory = testEnv.authenticatedContext('mallory');
      await assertFails(
        setDoc(doc(mallory.firestore(), 'summative_attempts', 'impersonation_student1'), {
          id: 'impersonation_student1',
          exam_id: 'impersonation',
          student_name: 'Not me',
          student_uid: 'student1',
          answers: {},
          submitted_at: Date.now(),
        })
      );
    });

    it('should DENY a student from writing their own score or grade', async () => {
      await seedExam('grading', { status: 'open' });
      await submit('grading');

      const student = testEnv.authenticatedContext('student1');
      const ref = doc(student.firestore(), 'summative_attempts', 'grading_student1');
      await assertFails(updateDoc(ref, { score: 100, grade: 5 }));
    });

    it('should ALLOW a teacher to write score and grade, and nothing else', async () => {
      await seedExam('teacher-grades', { status: 'open' });
      await submit('teacher-grades');

      const teacher = testEnv.authenticatedContext('teacher1');
      await setDoc(doc(teacher.firestore(), 'users', 'teacher1'), {
        uid: 'teacher1',
        email: 'teacher@test.com',
        displayName: 'Teacher',
        role: 'teacher',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      const ref = doc(teacher.firestore(), 'summative_attempts', 'teacher-grades_student1');
      await assertSucceeds(updateDoc(ref, { score: 88, grade: 4 }));
      // Answers must stay exactly as the student submitted them
      await assertFails(updateDoc(ref, { answers: { 0: 'tampered' } }));
    });
  });
});

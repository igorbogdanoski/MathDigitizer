import { describe, it, expect } from 'vitest';
import {
  toSharedTask,
  toSharedTaskExport,
  sharedTasksToLatex,
  sharedTasksToMarkdown,
} from './sharedTaskFormat';
import { tasksToSlideDeck } from './slidesExport';
import { tasksByCurriculum, UNCATEGORIZED_TOPIC_ID } from './curriculumExport';
import { MathTask } from './schema';

const makeTask = (overrides: Partial<MathTask> = {}): MathTask => ({
  id: 'task-1',
  title: 'Дропки',
  original_text: 'Пресметај $\\frac{1}{2} + \\frac{1}{3}$.',
  solution_steps: ['Најди НЗС', 'Собери ги дропките'],
  latex_formulas: ['\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}'],
  source_url: 'https://example.com',
  tags: ['дропки'],
  difficulty: 'medium',
  type: 'task',
  ...overrides,
});

describe('toSharedTask', () => {
  it('maps required fields and stamps source/format_version', () => {
    const shared = toSharedTask(makeTask({ created_at: '2026-01-01T00:00:00.000Z' }));
    expect(shared.id).toBe('task-1');
    expect(shared.title).toBe('Дропки');
    expect(shared.solution_steps).toHaveLength(2);
    expect(shared.difficulty).toBe('medium');
    expect(shared.type).toBe('task');
    expect(shared.source).toBe('mathdigitizer');
    expect(shared.format_version).toBe('1.0');
    expect(shared.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('resolves curriculum_refs only on exact grade+topic match', () => {
    const withTopic = toSharedTask(
      makeTask({ grade_level: '6', curriculum_topic: 'Броеви' })
    );
    expect(withTopic.curriculum_refs?.[0]).toMatchObject({
      education_track: 'primary',
      grade: '6',
      topic_id: 'mk-6-broevi',
      topic_name: 'Броеви',
    });
    // Contract §3: outcome codes are never guessed from text.
    expect(withTopic.curriculum_refs?.[0].outcome_codes).toEqual([]);

    const noTopic = toSharedTask(makeTask({ grade_level: '6' }));
    expect(noTopic.curriculum_refs).toBeUndefined();

    const unknownTopic = toSharedTask(
      makeTask({ grade_level: '6', curriculum_topic: 'Непостоечка тема' })
    );
    expect(unknownTopic.curriculum_refs).toBeUndefined();
  });

  it('normalizes free-form grade_level text like "6то одделение"', () => {
    const shared = toSharedTask(
      makeTask({ grade_level: '6то одделение', curriculum_topic: 'Геометрија' })
    );
    expect(shared.curriculum_refs?.[0].topic_id).toBe('mk-6-geometrija');
  });
});

describe('toSharedTaskExport', () => {
  it('builds envelope with metadata and maps target apps', () => {
    const tasks = [
      makeTask({ id: 'a', grade_level: '6', curriculum_topic: 'Броеви' }),
      makeTask({ id: 'b', grade_level: '7', title: 'Равенки' }),
    ];
    const exportPayload = toSharedTaskExport(tasks, 'curriculum');
    expect(exportPayload.app_target).toBe('ai-navigator');
    expect(exportPayload.metadata.total_tasks).toBe(2);
    expect(exportPayload.metadata.grades).toEqual(['6', '7']);
    expect(exportPayload.metadata.topics).toContain('Броеви');
    expect(exportPayload.tasks.map((t) => t.id)).toEqual(['a', 'b']);
    expect(exportPayload.export_id).toMatch(/^exp-/);

    expect(toSharedTaskExport(tasks, 'slides').app_target).toBe('slides');
    expect(toSharedTaskExport(tasks, 'anything-else').app_target).toBe('generic');
  });
});

describe('serializers', () => {
  it('renders latex and markdown', () => {
    const shared = [toSharedTask(makeTask())];
    const tex = sharedTasksToLatex(shared);
    expect(tex).toContain('\\documentclass{article}');
    expect(tex).toContain('Дропки');

    const md = sharedTasksToMarkdown(shared);
    expect(md).toContain('# Извлечени Едукативни Материјали');
    expect(md).toContain('## Задача 1: Дропки');
  });
});

describe('tasksToSlideDeck', () => {
  it('produces question/step/answer slides with last step as answer', () => {
    const deck = tasksToSlideDeck([makeTask()]);
    expect(deck.title).toBe('Дропки');
    expect(deck.metadata.task_count).toBe(1);
    const types = deck.slides.map((s) => s.type);
    expect(types[0]).toBe('title');
    expect(types).toContain('question');
    expect(types[types.length - 1]).toBe('answer');
    expect(deck.slides.filter((s) => s.type === 'step')).toHaveLength(1);
  });

  it('merges multiple tasks and adds a summary slide', () => {
    const deck = tasksToSlideDeck([makeTask({ id: 'a' }), makeTask({ id: 'b', title: 'Втора' })]);
    expect(deck.metadata.task_count).toBe(2);
    expect(deck.slides[0].type).toBe('title');
    expect(deck.slides[deck.slides.length - 1].type).toBe('summary');
  });
});

describe('tasksByCurriculum', () => {
  it('groups by resolved topic and buckets the rest as uncategorized', () => {
    const grouped = tasksByCurriculum([
      makeTask({ id: 'a', grade_level: '6', curriculum_topic: 'Броеви' }),
      makeTask({ id: 'b', title: 'Без тема' }),
    ]);
    expect(grouped['mk-6-broevi'].tasks.map((t) => t.id)).toEqual(['a']);
    expect(grouped['mk-6-broevi'].topic_name).toBe('Броеви');
    expect(grouped[UNCATEGORIZED_TOPIC_ID].tasks.map((t) => t.id)).toEqual(['b']);
  });
});

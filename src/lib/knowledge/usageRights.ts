/**
 * The right-to-use gate before a textbook is distilled
 * (EXPERT_LEVEL_MASTER_PLAN, 10.3).
 *
 * Distillation takes someone's book, sends it to a model, and keeps a derived
 * version in this app's database. Whether that is allowed depends on the book,
 * and the app cannot know — so the person uploading declares it, and the
 * declaration is stored with the result rather than being a checkbox that
 * disappears once clicked. If a publisher ever asks, the answer is a record.
 *
 * The gate is a value, not a UI convention. A dialog can be bypassed by calling
 * the function underneath it; a required argument cannot.
 */

export type UsageBasis =
  /** The teacher wrote it, or their school owns it. */
  | 'own_work'
  /** Published under a licence that permits derivative use. */
  | 'open_licence'
  /** The publisher or author gave permission. */
  | 'permission'
  /** Out of copyright. */
  | 'public_domain'
  /** A copy the school bought, used for its own teaching. */
  | 'institutional_copy';

export interface UsageDeclaration {
  basis: UsageBasis;
  /** Who declared it — a uid, so the record names a person. */
  declaredBy: string;
  /** ISO timestamp of the declaration. */
  declaredAt: string;
  /** The licence, permission reference or purchase note, where there is one. */
  note?: string;
}

/**
 * Bases that need the teacher to say *which* licence or permission.
 *
 * "Open licence" without naming one is not a declaration, it is a hope: CC BY
 * and CC BY-NC-ND permit very different things, and a teacher who cannot name
 * the licence has not checked it. `own_work` and `public_domain` need no note —
 * there is nothing to point at.
 */
const REQUIRES_NOTE: ReadonlySet<UsageBasis> = new Set<UsageBasis>([
  'open_licence',
  'permission',
  'institutional_copy',
]);

export function requiresNote(basis: UsageBasis): boolean {
  return REQUIRES_NOTE.has(basis);
}

export interface DeclarationProblem {
  field: 'basis' | 'declaredBy' | 'declaredAt' | 'note';
  reason: string;
}

/**
 * Checks a declaration before it is allowed to gate anything.
 *
 * Returns the problems rather than a boolean so the UI can say which part is
 * missing. An empty array means the declaration stands.
 */
export function validateUsageDeclaration(
  declaration: Partial<UsageDeclaration> | undefined | null,
): DeclarationProblem[] {
  const problems: DeclarationProblem[] = [];
  const value = declaration ?? {};

  if (!value.basis || !isUsageBasis(value.basis)) {
    problems.push({ field: 'basis', reason: 'Не е избрана основа за користење.' });
  } else if (requiresNote(value.basis) && !value.note?.trim()) {
    problems.push({
      field: 'note',
      reason: 'Оваа основа бара да се наведе лиценцата, дозволата или примерокот.',
    });
  }

  if (!value.declaredBy?.trim()) {
    problems.push({ field: 'declaredBy', reason: 'Изјавата мора да носи кој ја дал.' });
  }

  if (!value.declaredAt || Number.isNaN(Date.parse(value.declaredAt))) {
    problems.push({ field: 'declaredAt', reason: 'Изјавата мора да носи кога е дадена.' });
  }

  return problems;
}

const ALL_BASES: readonly UsageBasis[] = [
  'own_work',
  'open_licence',
  'permission',
  'public_domain',
  'institutional_copy',
];

export function isUsageBasis(value: unknown): value is UsageBasis {
  return typeof value === 'string' && (ALL_BASES as readonly string[]).includes(value);
}

export const USAGE_BASES = ALL_BASES;

/**
 * Thrown when distillation is attempted without a sound declaration.
 *
 * A distinct type so a caller cannot mistake it for a network or model failure
 * and retry it away.
 */
export class UsageRightsError extends Error {
  readonly problems: DeclarationProblem[];

  constructor(problems: DeclarationProblem[]) {
    super(`Нема важечка изјава за право на користење: ${problems.map(p => p.reason).join(' ')}`);
    this.name = 'UsageRightsError';
    this.problems = problems;
  }
}

/** Throws unless the declaration stands. Called at the top of distillation. */
export function assertUsageRights(declaration: Partial<UsageDeclaration> | undefined | null): UsageDeclaration {
  const problems = validateUsageDeclaration(declaration);
  if (problems.length > 0) throw new UsageRightsError(problems);
  return declaration as UsageDeclaration;
}

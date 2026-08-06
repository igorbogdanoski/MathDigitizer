import { IngestionPolicyMode } from './policy';

export interface IngestionPolicyOverrides {
  userInputMode?: IngestionPolicyMode;
  sourceContentMode?: IngestionPolicyMode;
}

function parseMode(value: string | undefined, fallback: IngestionPolicyMode): IngestionPolicyMode {
  if (!value) return fallback;
  return value.toLowerCase() === 'strict' ? 'strict' : 'advisory';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

export function resolveIngestionPolicyModes(
  overrides?: IngestionPolicyOverrides
): { userInputMode: IngestionPolicyMode; sourceContentMode: IngestionPolicyMode } {
  if (overrides?.userInputMode || overrides?.sourceContentMode) {
    return {
      userInputMode: overrides.userInputMode ?? 'strict',
      sourceContentMode: overrides.sourceContentMode ?? 'advisory',
    };
  }

  const env = (import.meta as any)?.env ?? {};
  const userInputMode = parseMode(env.VITE_INGESTION_POLICY_USER_INPUT_MODE, 'strict');
  const sourceContentMode = parseMode(env.VITE_INGESTION_POLICY_SOURCE_CONTENT_MODE, 'advisory');

  return { userInputMode, sourceContentMode };
}

export function resolveIngestionSnapshotPersistenceEnabled(override?: boolean): boolean {
  if (typeof override === 'boolean') return override;
  const env = (import.meta as any)?.env ?? {};
  return parseBoolean(env.VITE_INGESTION_SNAPSHOT_PERSIST, false);
}

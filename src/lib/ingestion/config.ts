import { IngestionPolicyMode } from './policy';

export interface IngestionPolicyOverrides {
  userInputMode?: IngestionPolicyMode;
  sourceContentMode?: IngestionPolicyMode;
}

function parseMode(value: string | undefined, fallback: IngestionPolicyMode): IngestionPolicyMode {
  if (!value) return fallback;
  return value.toLowerCase() === 'strict' ? 'strict' : 'advisory';
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

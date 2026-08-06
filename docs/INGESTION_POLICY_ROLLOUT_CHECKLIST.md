# Ingestion Policy Rollout Checklist

## Goal

Roll out ingestion security and optional metadata persistence safely across environments without breaking extraction reliability.

## Feature Flags and Controls

1. Policy strictness controls.

- `VITE_INGESTION_POLICY_USER_INPUT_MODE`: `strict` or `advisory`.
- `VITE_INGESTION_POLICY_SOURCE_CONTENT_MODE`: `strict` or `advisory`.

1. Optional metadata persistence control.

- `VITE_INGESTION_SNAPSHOT_PERSIST`: `true` or `false`.
- Default should remain `false` until Firestore and QA checks are complete.

1. Diagnostics endpoint protection.

- `INGESTION_DIAGNOSTICS_KEY` for non-public diagnostics access.
- Required request header: `x-admin-key`.

## Environment Baseline

1. Development.

- user input mode: `strict`
- source content mode: `advisory`
- snapshot persist: `false`
- diagnostics key: optional

1. Staging.

- user input mode: `strict`
- source content mode: `advisory`
- snapshot persist: `true` for limited validation window
- diagnostics key: required

1. Production.

- user input mode: `strict`
- source content mode: `advisory`
- snapshot persist: start at `false`, then canary to `true`
- diagnostics key: required

## Pre-Release Validation

1. Run local ingestion quality gate.

- `npm run quality:ingestion`

1. Validate diagnostics endpoint contract.

- `GET /api/ingestion/diagnostics`
- `GET /api/ingestion/diagnostics?preflight=false`

1. Validate blocked high-risk instruction behavior.

- inject known `high` patterns into user custom instructions
- confirm strict block message and no save side effects

1. Validate advisory behavior on source text.

- include suspicious source phrases
- confirm extraction continues and warning metadata is visible

1. Validate Firestore compatibility when snapshot is enabled.

- save extracted tasks with `VITE_INGESTION_SNAPSHOT_PERSIST=true`
- confirm writes pass rules and include bounded `ingestion_snapshot`

## Canary Plan

1. Start with 5 to 10 percent of internal reviewer traffic.
2. Monitor for 24 to 48 hours.
3. Expand to 25 percent if no error spike.
4. Expand to 100 percent when all quality signals remain stable.

## Success Criteria

1. No increase in task save failures.
2. No extraction success-rate drop beyond agreed threshold.
3. Warning interpretation remains consistent in reviewer QA.
4. No unauthorized diagnostics access events.

## Rollback Triggers

1. Task write failures increase after enabling snapshot persistence.
2. High-severity warning rates spike due to false positives.
3. Significant latency increase in extraction flow.
4. Diagnostics endpoint access anomalies.

## Rollback Actions

1. Set `VITE_INGESTION_SNAPSHOT_PERSIST=false` immediately.
2. Keep user input mode `strict` and source content mode `advisory`.
3. Rotate `INGESTION_DIAGNOSTICS_KEY` if access concern exists.
4. Open incident note with timestamps, config values, and sample failures.

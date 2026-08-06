# Ingestion High-Severity Signal Runbook

## Purpose

This runbook defines operational checks when high-severity ingestion signals increase unexpectedly.

## Trigger Conditions

Start this runbook when one or more of these conditions are true:

1. High-severity signals increase by 2x compared to the previous 24-hour baseline.
2. High-severity signals appear repeatedly for trusted source domains.
3. Extraction success rate drops while high-severity signals increase.
4. Reviewers report repeated false-positive blocks for normal teacher instructions.

## Immediate Triage (First 30 Minutes)

1. Confirm diagnostics health.

- Open `GET /api/ingestion/diagnostics?preflight=false`.
- Verify policy modes and current scanner rule counts.

1. Verify environment policy values.

- `VITE_INGESTION_POLICY_USER_INPUT_MODE`
- `VITE_INGESTION_POLICY_SOURCE_CONTENT_MODE`
- `VITE_INGESTION_SNAPSHOT_PERSIST`

1. Check for deploy/config drift.

- Confirm latest release and env variables match expected values.
- Verify no accidental change to strict/advisory mode routing.

## Investigation Checklist

1. Collect recent sample payloads (redacted).

- Capture representative examples for each frequent finding ID.
- Preserve source type (`url`, `text`, `file`) and parser path.

1. Segment by source profile.

- trusted curriculum content,
- user-provided custom instructions,
- imported transcript/web content.

1. Identify dominant finding IDs.

- quantify top 3 to 5 IDs,
- measure concentration by source type.

1. Validate whether signals are true positives.

- reviewer checks extracted task correctness,
- compare blocked vs allowed outcomes,
- note false-positive cases explicitly.

## Containment Actions

1. If false positives dominate user instructions.

- temporarily switch `VITE_INGESTION_POLICY_USER_INPUT_MODE=advisory` in staging first,
- keep production strict unless impact is critical,
- prepare targeted rule tuning patch.

1. If source-text advisories are noisy but non-blocking.

- keep source mode advisory,
- strengthen reviewer guidance,
- avoid aggressive strict mode changes without validation.

1. If malicious patterns are confirmed.

- keep or enforce strict user-input mode,
- add specific detection rule updates,
- increase monitoring cadence.

## Communication Template

1. Incident summary.

- when detected,
- impacted flows,
- top finding IDs,
- current policy modes.

1. User impact statement.

- extraction blocked vs advisory-only impact,
- expected mitigation timeline.

1. Next update cadence.

- every 60 minutes until stabilized.

## Exit Criteria

Close the runbook when:

1. High-severity rate returns within 20 percent of baseline for 24 hours.
2. No active extraction error spike is present.
3. Any temporary policy adjustments are reviewed and documented.
4. Follow-up ticket is created for permanent rule improvements.

## Post-Incident Actions

1. Add validated false-positive patterns to tuning backlog.
2. Add or update deterministic unit tests for affected finding IDs.
3. Update reviewer guide if action guidance changed.
4. Record incident timeline in internal engineering notes.

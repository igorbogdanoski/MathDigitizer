# Ingestion Warnings Reviewer Guide

## Purpose

This guide helps reviewers interpret ingestion safety signals from the Extraction Safety Panel and the diagnostics endpoint.

## Signal Sources

1. Sanitization summary.

Indicates whether invisible Unicode or bidi control characters were removed.
Signal fields: `sanitize.changed`, `removedInvisibleCount`, `removedBidiCount`.

1. Injection scan summary.

Indicates potential instruction-manipulation patterns inside input or source text.
Signal fields: `scan.highestSeverity`, `scan.findingIds`.

1. Parser path summary.

Indicates extraction route used by ingestion.
Signal field: `parserPath`.

## Severity Matrix

1. `high`

Meaning: text includes strong prompt-injection or safety-bypass patterns.
Typical IDs: `prompt.ignore_previous`, `prompt.reveal_system`, `prompt.tool_exfiltration`, `prompt.bypass_safety`.
Default action: if signal came from user instructions (strict mode), extraction blocks and user must revise input. If signal came from source content (advisory mode), extraction may continue, but reviewer should verify results before publishing.

1. `medium`

Meaning: role-override style language detected.
Typical IDs: `prompt.role_override`.
Default action: continue with caution, manually validate extracted task meaning and solution consistency.

1. `low`

Meaning: weak indicator or delimiter pattern detected.
Typical IDs: `prompt.instruction_delimiters`.
Default action: informational; no block expected.

1. `none`

Meaning: no scanner findings.
Default action: proceed with normal QA flow.

## Reviewer Decision Flow

1. Check `sourceKind` and `parserPath` first.

Unexpected parser fallback should increase manual review depth.

1. Check sanitization change flag.

If `sanitize.changed` is true and counts are high, inspect math notation and directionality-sensitive text.

1. Check highest severity and finding IDs.

`high`: do a focused manual verification of final extracted tasks before approval.
`medium`: verify wording and authority claims did not alter math semantics.
`low`: no extra action unless output quality looks suspicious.

1. Confirm task-level correctness.

Validate exercise intent, formulas, units, and constraints.

1. Record action in reviewer notes.

Include finding IDs and whether issue was false positive, corrected upstream, or blocked.

## False Positive Handling

1. Do not disable scanner rules ad-hoc.
2. Collect at least 3 repeated false-positive cases with examples.
3. Propose a rule-tuning change with before/after evidence.
4. Apply changes behind standard review and test gates.

## Admin Diagnostics Endpoint

1. Endpoint: `GET /api/ingestion/diagnostics`.

2. Optional query: `?preflight=false` to skip dependency checks.

3. Optional security: set `INGESTION_DIAGNOSTICS_KEY` and pass header `x-admin-key`.

4. Intended use:

Dashboard health checks, policy mode verification per environment, and scanner rule inventory visibility.

## Escalation Criteria

Escalate to engineering when any of the following happens:

1. High-severity findings appear repeatedly in trusted content sources.
2. Sanitization removes large character volumes and output quality drops.
3. Parser fallback frequency spikes unexpectedly.
4. Reviewer confidence drops due to unclear warning interpretation.

# Pedagogy QA Summary Template (v2)

Date:
Sprint Day: 11
Owner:

## 1. Dataset Coverage

- Total golden prompts:
- Easy prompts:
- Medium prompts:
- Difficult prompts:
- Edge-case prompts:

### Covered Scenario Tags

- [ ] Scaffolded remediation
- [ ] Multi-step reasoning (ToT)
- [ ] Misconception diagnosis
- [ ] Low-context safe fallback
- [ ] Retrieval-grounded prompting

## 2. Threshold Configuration

Per-dimension pass thresholds:

- protocol >= 7/10
- theory >= 7/10
- safety >= 7/10
- outputContract >= 6/10
- retrieval >= 6/10

Total score thresholds:

- pass >= 42/50
- warn >= 30/50
- fail < 30/50 or any dimension below threshold

## 3. Run Summary

- Generated at:
- Total prompts evaluated:
- Passed:
- Warned:
- Failed:
- Token coverage (all expected tokens present):
- Average total score:

## 4. Dimension Aggregates

| Dimension | Avg Score | Min Score | Threshold | Status |
|---|---:|---:|---:|---|
| protocol |  |  | 7 |  |
| theory |  |  | 7 |  |
| safety |  |  | 7 |  |
| outputContract |  |  | 6 |  |
| retrieval |  |  | 6 |  |

## 5. Failing/Warn Cases

List every prompt with status warn/fail and remediation action.

| Prompt ID | Label | Status | Weak Dimension(s) | Remediation Task |
|---|---|---|---|---|

## 6. Regression Check vs Previous Run

- Previous pass count:
- Current pass count:
- Delta:
- New failures introduced:
- Resolved failures:

## 7. Decision

- Gate decision: PASS / WARN / FAIL
- Merge recommendation:
- Next sprint action items:

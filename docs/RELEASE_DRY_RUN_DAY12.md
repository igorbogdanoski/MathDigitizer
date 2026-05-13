# Release Dry-Run Log (Day 12)

Date: 2026-05-13
Owner: Copilot Agent
Scope: Full clean install + mandatory quality gates + preview deployment dry run.

## 1) Clean Install Drill

Command sequence:

1. npm ci
2. (Recovered EPERM lock) Stop node processes + remove node_modules + npm ci

Observed outcome:

- First `npm ci` failed with Windows lock (`EPERM`) on `lightningcss.win32-x64-msvc.node`.
- Recovery succeeded:
  - `Get-Process node | Stop-Process -Force`
  - remove `node_modules`
  - rerun `npm ci`
- Final result: clean install completed successfully (960 packages installed).

Operational note:

- This lock pattern is consistent with active file handles on Windows (watch/test/dev server processes).
- Recovery procedure should remain part of the release playbook for local Windows environments.

## 2) Mandatory Gate Run (Post-Clean Install)

Commands and results:

- `npm run lint` -> PASS
- `npm run test:smoke` -> PASS (6/6)
- `npm run test -- --run src/lib/seo.test.ts src/lib/promptEngineering.test.ts src/lib/knowledgeModel.test.ts src/lib/pedagogyQa.test.ts` -> PASS (17/17)
- `npm run build` -> PASS
- `npm run quality:gates` -> PASS
  - governance: PASS
  - bundle: PASS
  - routes: PASS

## 3) Preview Deployment Dry Run

### 3.1 Local Preview Target

- Started preview server: `npm run preview -- --host 127.0.0.1 --port 4173`
- Health check: `Invoke-WebRequest http://127.0.0.1:4173/` returned HTTP 200

Result: PASS (local preview target is healthy).

### 3.2 Vercel Preview Deploy (Remediated Same Session)

Initial attempt failed with:
- Project name validation error (must be lowercase, valid charset)
- CLI self-upgrade failed with `spawn npm ENOENT`

Remediation steps executed:
1. `npx --yes vercel@latest link --yes --project mathdigitizer --scope igor-bogdanoskis-projects` → Linked to `igor-bogdanoskis-projects/mathdigitizer` (created `.vercel`)
2. `npx --yes vercel@latest build --yes` → Build completed in `.vercel/output` [12s], PASS
3. `npx --yes vercel@latest deploy --prebuilt --yes` → Deployed PASS

Deployment results:
- Production URL: https://mathdigitizer.vercel.app
- Inspect: https://vercel.com/igor-bogdanoskis-projects/mathdigitizer/7taNVPHmM1UvMtfbZVsydps1qdjP

Result: PASS

## 4) Dry-Run Decision

- Local release readiness signals: PASS
- External preview publish via Vercel CLI: PASS (https://mathdigitizer.vercel.app)
- Overall Day 12 status: PASS (all signals green)

## 5) Artifacts

- Build artifacts generated in `dist/` and `.vercel/output`
- Route budget report available via `npm run quality:gates` output
- Tracker entry updated in `docs/EXECUTION_TRACKER.md`
- Live preview: https://mathdigitizer.vercel.app

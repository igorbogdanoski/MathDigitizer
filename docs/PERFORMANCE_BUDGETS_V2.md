# Performance Budgets v2

Date: 2026-05-13

## Scope

Day 10 deliverable for per-route performance budgets plus baseline trend regression checks.

## Implemented Checks

1. Per-route lazy payload budgets (key routes)

- `/` via `src/components/Home.tsx` <= 1400 KB
- `/pricing` via `src/components/Pricing.tsx` <= 900 KB
- `/extract` via `src/components/ExtractionEngine.tsx` <= 2000 KB
- `/smart-ocr` via `src/components/SmartOCR.tsx` <= 2000 KB
- `/library` via `src/components/Library.tsx` <= 2200 KB
- `/dashboard` via `src/components/Dashboard.tsx` <= 1100 KB
- `/live-board` via `src/components/live/VirtualWhiteboardPage.tsx` <= 1500 KB
- `/analytics` via `src/components/AnalyticsDashboard.tsx` <= 1700 KB

Method: route chunk graph computed from Vite manifest and measured as route-specific incremental payload by excluding initial app bootstrap assets.

2. Baseline trend regression checks

- Baseline JS total: 4533 KB
- Baseline CSS total: 250 KB
- Allowed regression threshold: +10% (JS and CSS)

## CI Wiring

- New script: `scripts/check-route-budgets.mjs`
- New npm command: `npm run quality:routes`
- Included in `npm run quality:gates`

## Latest Check Output (2026-05-13)

Per-route:

- `/`: 444.36 KB / 1400 KB
- `/pricing`: 55.71 KB / 900 KB
- `/extract`: 511.30 KB / 2000 KB
- `/smart-ocr`: 446.39 KB / 2000 KB
- `/library`: 609.24 KB / 2200 KB
- `/dashboard`: 900.10 KB / 1100 KB
- `/live-board`: 481.50 KB / 1500 KB
- `/analytics`: 875.32 KB / 1700 KB

Trend vs baseline:

- JS total: 4539.28 KB (delta +6.28 KB, limit 4986.30 KB)
- CSS total: 250.70 KB (delta +0.70 KB, limit 275.00 KB)

Status: PASS

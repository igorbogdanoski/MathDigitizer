# Cross-App Export API — MathDigitizer Pro

**Base URL:** `https://math.mismath.net` (Express backend, `server.ts`)
**API version:** 1.0 · **SharedTask format_version:** `'1.0'`

The Export API serves the task library of MathDigitizer Pro in the
**SharedTask** interchange format (`src/lib/sharedTaskFormat.ts`) to the
sibling apps of the mismath.net family:

| Consumer | Origin | Primary endpoints |
|---|---|---|
| math-curriculum-ai-navigator | `https://ai.mismath.net` | `/api/export/curriculum`, `/api/export/tasks` |
| mkd-slidea | `https://slides.mismath.net` | `/api/export/slides/:taskId`, `/api/export/batch` |
| generic integrations | any allowlisted origin | `/api/export/tasks`, `/api/export/batch` |

CORS is open for `https://math.mismath.net`, `https://ai.mismath.net` and
`https://slides.mismath.net` (overridable via the `ALLOWED_ORIGINS` env var,
comma-separated). All cross-origin requests must send a browser `Origin`
header from that allowlist; requests without an `Origin` header (server-to-
server) are allowed through.

---

## Authentication

Every `/api/export/*` route requires a **Firebase ID token**:

```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

The token is verified with Firebase Admin (`admin.auth().verifyIdToken`).
Client apps obtain a token from Firebase Auth:

```js
import { getAuth } from 'firebase/auth';
const token = await getAuth().currentUser.getIdToken();
```

Responses:

| Status | Meaning |
|---|---|
| `401` | Missing, invalid or expired token |
| `503` | Firebase Admin not configured on the server (or auth unavailable in production) |

> Dev-only note: when the server runs without Firebase Admin credentials and
> `NODE_ENV !== "production"`, auth is skipped. In production the server fails
> closed.

## Rate limits

`/api/export/*` is limited to **120 requests / minute per IP** (fixed window).
When exceeded the API returns `429` with a `Retry-After` header (seconds).
Batch endpoints additionally cap payloads:

- `GET /api/export/tasks` — max `limit=200` per page, server scans at most 1000 docs per query
- `POST /api/export/batch` — max 100 task ids per request

---

## The SharedTask format

```ts
interface SharedTask {
  id: string;
  title: string;
  original_text: string;      // LaTeX-enabled ($...$ inline math)
  solution_steps: string[];
  latex_formulas: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'task' | 'theory';
  dok_level?: number;
  bloom_taxonomy?: string;
  grade_level?: string;
  curriculum_refs?: {
    education_track: string;  // primary | secondary_general | secondary_math_info | secondary_vocational
    grade: string;            // БРО grade key: "1".."9", "1год".."4год", "1год-миг", …
    topic_id: string;         // e.g. "mk-6-ravnenki"
    topic_name: string;
    outcome_codes: string[];  // БРО codes, e.g. "МА.6.2.3" — see note below
  }[];
  geogebra_commands?: string[];
  hints?: string[];
  created_at: string;         // ISO 8601
  source: 'mathdigitizer';
  format_version: '1.0';
}
```

**Curriculum codes policy** (per `docs/SHARED_CURRICULUM_CONTRACT.md`): outcome
codes travel with the content and are never guessed from text. MathDigitizer's
`MathTask` does not carry per-task outcome codes yet, so `outcome_codes` is
`[]` until the `outcomes` field lands on `MathTask`. `curriculum_refs` itself
is only present when `grade_level` + `curriculum_topic` resolve to an official
БРО grade/topic with an exact match — otherwise the field is omitted.

Batch/list responses may be wrapped in the export envelope:

```ts
interface SharedTaskExport {
  export_id: string;
  exported_at: string;        // ISO 8601
  app_target: 'ai-navigator' | 'slides' | 'generic';
  tasks: SharedTask[];
  metadata: {
    total_tasks: number;
    grades: string[];
    topics: string[];
  };
}
```

---

## Endpoints

### `GET /api/health`

Health check (public — no auth).

```bash
curl https://math.mismath.net/api/health
```

```json
{ "status": "ok", "version": "0.0.0", "api_version": "1.0", "tasks_count": 1234 }
```

---

### `GET /api/export/tasks`

List tasks with filters, newest first.

**Query params**

| Param | Values | Default |
|---|---|---|
| `grade` | exact `grade_level` value (e.g. `6`) | — |
| `topic` | matches `curriculum_topic` **or** a tag | — |
| `difficulty` | `easy` \| `medium` \| `hard` | — |
| `type` | `task` \| `theory` | — |
| `limit` | 1–200 | 50 |
| `offset` | ≥ 0 | 0 |
| `format` | `json` \| `latex` \| `markdown` | `json` |

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://math.mismath.net/api/export/tasks?grade=6&difficulty=easy&limit=20"
```

```json
{
  "tasks": [
    {
      "id": "abc123",
      "title": "Линеарна равенка",
      "original_text": "Реши ја равенката $2x + 3 = 11$.",
      "solution_steps": ["Одземи 3 од двете страни", "Подели со 2"],
      "latex_formulas": ["2x+3=11", "x=4"],
      "tags": ["равенки"],
      "difficulty": "easy",
      "type": "task",
      "grade_level": "6",
      "curriculum_refs": [{
        "education_track": "primary",
        "grade": "6",
        "topic_id": "mk-6-ravnenki",
        "topic_name": "Равенки",
        "outcome_codes": []
      }],
      "created_at": "2026-07-01T10:00:00.000Z",
      "source": "mathdigitizer",
      "format_version": "1.0"
    }
  ],
  "total": 42
}
```

With `format=latex` / `format=markdown` the response is a plain-text document
(`text/plain` / `text/markdown`) instead of JSON; `total` is not included.

---

### `GET /api/export/tasks/:id`

Single task as `SharedTask`. Returns `404` when the task does not exist.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://math.mismath.net/api/export/tasks/abc123
```

---

### `POST /api/export/batch`

Export specific task ids as a `SharedTaskExport` envelope.

**Body**

```json
{ "taskIds": ["abc123", "def456"], "format": "json" }
```

`format`: `json` (→ `app_target: "generic"`), `slides` (→ `"slides"`),
`curriculum` (→ `"ai-navigator"`). Max 100 ids.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"taskIds":["abc123"],"format":"curriculum"}' \
  https://math.mismath.net/api/export/batch
```

```json
{
  "export_id": "exp-m2abc-x4y9",
  "exported_at": "2026-08-06T12:00:00.000Z",
  "app_target": "ai-navigator",
  "tasks": [ { "id": "abc123", "…": "SharedTask" } ],
  "metadata": { "total_tasks": 1, "grades": ["6"], "topics": ["Равенки"] }
}
```

---

### `GET /api/export/slides/:taskId` — for slides.mismath.net

Slide-ready rendering of one task. Each solution step becomes a slide; the
**last** solution step is emitted as the `answer` slide.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://math.mismath.net/api/export/slides/abc123
```

```json
{
  "title": "Линеарна равенка",
  "slides": [
    { "type": "question", "content": "Реши ја равенката $2x + 3 = 11$.", "latex": ["2x+3=11", "x=4"] },
    { "type": "step", "content": "1. Одземи 3 од двете страни" },
    { "type": "answer", "content": "Подели со 2" }
  ]
}
```

`latex` is present only when the task has extracted formulas. For full decks
(including `title`/`summary` slides and teacher `notes`) use the client-side
`tasksToSlideDeck()` in `src/lib/slidesExport.ts` or the Slides format in the
Export panel.

---

### `GET /api/export/curriculum` — for ai.mismath.net

Tasks grouped by `curriculum_refs.topic_id`. Tasks without a resolvable
curriculum reference land in the stable `uncategorized` bucket.

**Query params:** `grade` (exact `grade_level`), `track`
(`primary` | `secondary_general` | `secondary_math_info` | `secondary_vocational`).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://math.mismath.net/api/export/curriculum?grade=6&track=primary"
```

```json
{
  "mk-6-ravnenki": {
    "topic_id": "mk-6-ravnenki",
    "topic_name": "Равенки",
    "grade": "6",
    "tasks": [ { "id": "abc123", "…": "SharedTask" } ]
  },
  "uncategorized": {
    "topic_id": "uncategorized",
    "topic_name": "Некатегоризирани",
    "grade": "",
    "tasks": [ ]
  }
}
```

---

## Error shape

All errors are JSON: `{ "error": "message" }`.

| Status | When |
|---|---|
| `400` | Invalid/unknown filter values, malformed body, too many ids |
| `401` | Missing/invalid/expired Firebase token |
| `404` | Task id not found |
| `429` | Rate limit exceeded (see `Retry-After`) |
| `500` | Unexpected server error |
| `503` | Firebase Admin not configured |

---

## Integration guide

### For ai.mismath.net (math-curriculum-ai-navigator)

1. Get a Firebase ID token for the signed-in teacher.
2. Pull the curriculum map:
   `GET /api/export/curriculum?track=primary` (optionally `&grade=6`).
3. Index the response by `topic_id` — the keys match the navigator's topic ids
   when both apps resolve against the same БРО curriculum source. Tasks under
   `uncategorized` have no confident curriculum mapping; surface them as
   unmapped rather than guessing (contract §3).
4. When attaching a task to a topic client-side, keep `outcome_codes`
   untouched — never synthesize codes from task text.
5. For ad-hoc imports by id use `POST /api/export/batch` with
   `"format": "curriculum"`.

```ts
const res = await fetch(`${BASE}/api/export/curriculum?track=primary`, {
  headers: { Authorization: `Bearer ${token}` },
});
const groups: Record<string, { topic_id: string; topic_name: string; grade: string; tasks: SharedTask[] }> =
  await res.json();
```

### For slides.mismath.net (mkd-slidea)

1. Single task → `GET /api/export/slides/:taskId`; map `question`/`step`/
   `answer` slides onto Slidea slides; render `content` with your LaTeX
   renderer (content is LaTeX-enabled).
2. Multi-task decks → `POST /api/export/batch` with `"format": "slides"`, then
   build the deck from the returned `SharedTask[]` (or import the deck JSON
   produced by the Export panel — same `SlideDeck` shape as
   `src/lib/slidesExport.ts`).
3. `geogebra_commands` (available on full `SharedTask` objects) can drive
   GeoGebra embeds on geometry slides.
4. Respect the rate limit: cache decks per task id; revalidate on teacher
   action rather than polling.

### For generic consumers

- Discover: `GET /api/export/tasks?limit=200&offset=…` until `offset >= total`.
- Filter server-side where possible (`grade`, `topic`, `difficulty`, `type`)
  to stay inside the scan cap.
- All text fields are UTF-8 Macedonian by default; `original_text` and
  `solution_steps` contain `$...$` inline LaTeX.

---

## Versioning

`format_version: '1.0'` is part of every `SharedTask`. Breaking changes to the
shape require a new `format_version` and an update of this document in all
consuming repositories (same rule as the Shared Curriculum Contract §8).
Additive optional fields do not bump the version.

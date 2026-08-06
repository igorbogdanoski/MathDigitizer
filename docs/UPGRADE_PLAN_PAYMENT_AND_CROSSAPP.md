# MathDigitizer Pro — Детален План за Надградба

**Датум:** 2026-07-22
**Гранка:** `feat/payment-and-crossapp-api`
**Статус:** Во реализација

---

## Преглед на проектот

### Трите апликации на екосистемот:

| Апликација | Домен | Репозитори | Улога |
|-----------|-------|-----------|-------|
| **MathDigitizer Pro** | math.mismath.net | igorbogdanoski/MathDigitizer | Екстракција + менаџмент на задачи |
| **AI Curriculum Navigator** | ai.mismath.net | igorbogdanoski/math-curriculum-ai-navigator | Навигација низ наставна програма |
| **MKD Slides** | slides.mismath.net | igorbogdanoski/mkd-slidea | Презентациски слајдови за настава |

### Цел на надградбата:
1. **Автоматизиран billing** (bank transfer workflow, без Stripe)
2. **Cross-app API** (задачите од MathDigitizer → Navigator + Slides)

---

---

# ДЕЛ 1: PAYMENT AUTOMATION

## 1.1 Тековна состојба

**Рачен процес:**
1. Корисник кликнува "Activate Pro" на Pricing
2. Плаќа преку банка (IBAN: MK07210501596102457, SWIFT: TUTNMK22, NLB Bank)
3. Upload receipt на BillingDashboard
4. Admin рачно проверува во SchoolInquiriesDashboard
5. Admin approve → рачно ажурира Firestore `users.isPro = true`

**Проблеми:**
- Нема автоматска invoice генерација
- Нема email нотификации
- Нема статус tracking (pending → approved)
- Нема payment history per user
- Admin мора рачно да проверува

## 1.2 Целна состојба

```
Корисник → Pricing → "Activate Pro"
  → Payment Modal (plan избор + име + email)
  → "Generate Invoice" → PDF со IBAN/SWIFT
  → Плаќа во банка
  → "I've paid" → креира payment_intent (status: pending_payment)
  → Upload receipt → status: receipt_uploaded
  → Admin добива email notification
  → Admin approve во PaymentAdminDashboard
  → Auto: users.isPro = true + proEndsAt
  → Auto: confirmation email на корисник
  → Auto: billing_cta_click telemetry
```

## 1.3 Firestore Колекции

### Нова колекција: `payment_intents`

```typescript
interface PaymentIntent {
  id: string;                    // auto-generated
  user_id: string;               // Firebase Auth UID
  email: string;                 // корисник email
  customer_name: string;         // име за invoice
  plan: 'monthly' | 'annual';   // план
  amount: number;                // 490 или 4900 MKD
  currency: 'MKD';              // фиксно
  status: 
    | 'pending_payment'          // креиран, чека плаќање
    | 'receipt_uploaded'         // receipt прикачен
    | 'admin_review'            // admin го гледа
    | 'approved'                // одобрен
    | 'rejected'                // одбиен
    | 'expired';                // истечен (30 дена без плаќање)
  receipt_url?: string;          // URL на receipt во Storage
  invoice_number: string;        // MD-2026-0001 формат
  invoice_generated_at?: string;
  paid_at?: string;              // кога корисникот вели дека платил
  reviewed_by?: string;          // admin UID
  reviewed_at?: string;
  rejection_reason?: string;
  pro_activated_at?: string;     // кога е активиран Pro
  pro_expires_at?: string;       // кога истекува Pro
  created_at: string;
  updated_at: string;
}
```

### Правила за пристап (firestore.rules):

```
match /payment_intents/{id} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.user_id || isAdmin());
  allow create: if request.auth != null && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAdmin() || 
    (request.auth.uid == resource.data.user_id && 
     request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['status', 'receipt_url', 'paid_at', 'updated_at']));
}
```

## 1.4 Фајлови за креирање/промена

### 1.4.1 НОВ: `src/lib/invoicing.ts`

**Функции:**
```typescript
// Генерира HTML invoice (за print → PDF)
export function generateInvoiceHtml(params: InvoiceParams): string

// Генерира invoice number: MD-YYYY-NNNN
export function generateInvoiceNumber(): string

// Пресметува датуми
export function getInvoiceDates(plan: 'monthly' | 'annual'): { issue: string; due: string }
```

**InvoiceParams:**
```typescript
interface InvoiceParams {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  plan: 'monthly' | 'annual';
  amount: number;
  bankDetails: BankDetails;
  issueDate: string;
  dueDate: string;
}

interface BankDetails {
  bank: string;           // 'NLB Bank'
  iban: string;           // 'MK07210501596102457'
  swift: string;          // 'TUTNMK22'
  recipient: string;      // 'Игор Богданоски'
  address: string;        // адреса
}
```

**HTML Invoice содржина:**
- Header: MathDigitizer Pro лого + "ФАКТУРА / INVOICE"
- Invoice meta: број, датум, due date
- Customer info: име, email
- Line item: план (Pro Teacher Monthly/Annual), цена
- Вкупно: amount MKD
- Bank details: IBAN, SWIFT, банка, примач
- Payment instructions: "Плаќање преку банкaрска трансакција"
- Footer: "Фактурата е генерирана автоматски"
- Print button: `window.print()`

**i18n keys (додај во 'billing' namespace):**
```json
{
  "invoiceTitle": "ФАКТУРА / INVOICE",
  "invoiceNumber": "Број на фактура",
  "invoiceDate": "Датум",
  "invoiceDue": "Рок на плаќање",
  "invoiceCustomer": "Податоци за купувач",
  "invoicePlan": "План",
  "invoiceMonthly": "Pro Teacher (Месечен)",
  "invoiceAnnual": "Pro Teacher (Годишен)",
  "invoiceTotal": "Вкупно за плаќање",
  "invoiceBankDetails": "Податоци за плаќање",
  "invoiceBank": "Банка",
  "invoiceRecipient": "Примач",
  "invoiceInstructions": "Инструкции за плаќање",
  "invoicePayByBank": "Плаќање преку банкарска трансакција",
  "invoicePrint": "Зачувај како PDF",
  "invoiceFooter": "Фактурата е генерирана автоматски"
}
```

### 1.4.2 НОВ: `src/lib/paymentEmails.ts`

**Функции:**
```typescript
// Email кога корисник ќе креира payment intent
export async function sendPaymentIntentCreatedEmail(params: {
  toEmail: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  plan: string;
}): Promise<void>

// Email кога receipt е прикачен
export async function sendReceiptUploadedEmail(params: {
  toEmail: string;
  customerName: string;
  invoiceNumber: string;
}): Promise<void>

// Email кога admin ќе одобри
export async function sendProActivatedEmail(params: {
  toEmail: string;
  customerName: string;
  plan: string;
  expiresAt: string;
}): Promise<void>

// Email кога admin ќе одбие
export async function sendPaymentRejectedEmail(params: {
  toEmail: string;
  customerName: string;
  invoiceNumber: string;
  reason: string;
}): Promise<void>

// Email до admin за нов payment
export async function sendAdminPaymentNotificationEmail(params: {
  invoiceNumber: string;
  customerName: string;
  email: string;
  amount: number;
  plan: string;
}): Promise<void>
```

**Admin email:** igor.bogdanoski@mismath.net
**Шаблон:** Користи го постоечкиот `sendEmail` од `src/lib/emailService.ts`
**Subject линии:**
- `[MathDigitizer] Invoice ${invoiceNumber} - Payment Instructions`
- `[MathDigitizer] Receipt Received - Invoice ${invoiceNumber}`
- `[MathDigitizer] Pro Activated! Welcome aboard`
- `[MathDigitizer] Payment Issue - Invoice ${invoiceNumber}`
- `[MathDigitizer Admin] New Payment to Review - ${invoiceNumber}`

### 1.4.3 НОВ: `src/components/PaymentModal.tsx`

**Props:**
```typescript
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: 'monthly' | 'annual';
}
```

**Чекори во модалот:**
1. **Step 1: Plan confirmation**
   - Прикажи избран план + цена
   - Input: име, email (pre-filled од auth)
   - Button: "Generate Invoice"

2. **Step 2: Invoice + Bank details**
   - Прикажи invoice number
   - Прикажи IBAN/SWIFT/bank (copy buttons)
   - Button: "Download Invoice PDF"
   - Button: "I've Paid" → креира payment_intent

3. **Step 3: Receipt upload**
   - File upload (image/pdf)
   - Upload во Firebase Storage (`receipts/{userId}/{timestamp}`)
   - Update payment_intent.status = 'receipt_uploaded'
   - Button: "Submit"

4. **Step 4: Confirmation**
   - "Ви благодариме! Ќе го прегледаме плаќањето во рок од 24 часа."
   - Прикажи invoice number за референца

### 1.4.4 ПРОМЕНА: `src/components/Pricing.tsx`

**Додај:**
- "Activate Pro" button → отвора PaymentModal
- Replace existing checkout logic со PaymentModal
- Keep free tier info unchanged

### 1.4.5 НОВ: `src/components/PaymentAdminDashboard.tsx`

**Рути:** `/payment-admin` (admin-only, lazy loaded)

**Секции:**
1. **Summary cards:**
   - Вкупно pending payments
   - Approved денес
   - Revenue овој месец (сума од approved)
   - Rejected count

2. **Payment intents table:**
   - Columns: Invoice#, Customer, Email, Plan, Amount, Status, Date, Actions
   - Filter by status (all/pending/receipt_uploaded/approved/rejected)
   - Sort by date (newest first)
   - Per-row actions: View Receipt, Approve, Reject

3. **Receipt viewer:**
   - Modal со receipt image/pdf
   - Approve button → confirm dialog → activate Pro
   - Reject button → reason input → send rejection email

4. **Approve logic:**
```typescript
async function approvePayment(intent: PaymentIntent) {
  // 1. Update payment_intent status
  await updateDoc(doc(db, 'payment_intents', intent.id), {
    status: 'approved',
    reviewed_by: user.uid,
    reviewed_at: new Date().toISOString(),
    pro_activated_at: new Date().toISOString(),
    pro_expires_at: calculateExpiry(intent.plan),
  });
  
  // 2. Activate Pro on user
  await updateDoc(doc(db, 'users', intent.user_id), {
    isPro: true,
    proStartedAt: new Date().toISOString(),
    proEndsAt: calculateExpiry(intent.plan),
    paymentChannel: 'bank_transfer',
  });
  
  // 3. Send confirmation email
  await sendProActivatedEmail({...});
  
  // 4. Track analytics
  await addDoc(collection(db, 'ui_events'), {
    eventType: 'pro_activated',
    uid: intent.user_id,
    plan: intent.plan,
    source: 'payment_admin',
  });
}
```

### 1.4.6 ПРОМЕНА: `src/components/BillingDashboard.tsx`

**Додај:**
- Payment history табела (од payment_intents)
- Status badges (pending/approved/rejected)
- Download invoice button
- "Track payment" link за pending payments

### 1.4.7 ПРОМЕНА: `src/App.tsx`

**Додај route:**
```tsx
const PaymentAdminDashboard = lazy(() => import('./components/PaymentAdminDashboard'));

// Во routes:
<Route path="/payment-admin" element={
  <ProtectedRoute allowedRoles={['admin']}>
    <PaymentAdminDashboard />
  </ProtectedRoute>
} />
```

### 1.4.8 ПРОМЕНА: `src/components/Layout.tsx`

**Додај nav item** за /payment-admin (admin-only, со CreditCard икона)

## 1.5 Testing Checklist

- [ ] Invoice generation renders correctly (print preview)
- [ ] Invoice number format: MD-2026-0001
- [ ] Payment intent created with correct status
- [ ] Receipt upload to Firebase Storage works
- [ ] Admin notification email sent
- [ ] Approve activates Pro correctly
- [ ] Pro expiry calculated (30 days monthly, 365 days annual)
- [ ] Confirmation email sent after approval
- [ ] Rejection email with reason works
- [ ] BillingDashboard shows payment history
- [ ] PaymentAdminDashboard filters work
- [ ] Non-admin cannot access /payment-admin

---

---

# ДЕЛ 2: CROSS-APP EXPORT API

## 2.1 Тековна состојба

**Задачите во MathDigitizer имаат:**
- title, original_text (LaTeX), solution_steps, latex_formulas
- tags, difficulty, type, dok_level, bloom_taxonomy
- curriculum_refs (topic_id, outcome_codes, grade)
- geogebra_commands, hints
- Firestore: `tasks` колекција

**Проблем:**
- Другите апликации (ai.mismath.net, slides.mismath.net) немаат пристап
- Нема API за export
- Нема стандардизиран формат

## 2.2 Целна состојба

```
MathDigitizer
  ├── GET /api/export/tasks?grade=7&topic=...&format=json
  ├── GET /api/export/tasks/:id
  ├── POST /api/export/batch
  ├── GET /api/export/slides/:taskId
  ├── GET /api/export/curriculum?grade=7&track=primary
  └── GET /api/health
       ↓
  ai.mismath.net (чита curriculum-organized tasks)
  slides.mismath.net (генерира слајдови од tasks)
```

## 2.3 SharedTask Формат

### НОВ: `src/lib/sharedTaskFormat.ts`

```typescript
export interface SharedTask {
  id: string;
  title: string;
  original_text: string;
  solution_steps: string[];
  latex_formulas: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'task' | 'theory';
  dok_level?: number;
  bloom_taxonomy?: string;
  grade_level?: string;
  curriculum_refs?: CurriculumRefLite[];
  geogebra_commands?: string[];
  hints?: string[];
  pedagogical_insights?: {
    common_pitfalls?: string[];
    socratic_questions?: string[];
    teaching_strategy?: string;
  };
  created_at: string;
  source: 'mathdigitizer';
  format_version: '1.0';
}

export interface CurriculumRefLite {
  education_track: string;
  grade: string;
  topic_id: string;
  topic_name: string;
  outcome_codes: string[];
}

export interface SharedTaskExport {
  export_id: string;
  exported_at: string;
  app_target: 'ai-navigator' | 'slides' | 'generic';
  tasks: SharedTask[];
  metadata: {
    total_tasks: number;
    grades: string[];
    topics: string[];
    difficulties: string[];
  };
}

// Конвертори
export function toSharedTask(task: MathTask): SharedTask
export function toSharedTaskExport(tasks: MathTask[], target: string): SharedTaskExport
```

## 2.4 API Endpoints

### ПРОМЕНА: `server.ts`

#### `GET /api/health`
```typescript
// Response: { status: 'ok', version: '1.0', tasks_count: number, timestamp: string }
```

#### `GET /api/export/tasks`
```typescript
// Query params:
//   grade?: string       (filter by grade_level)
//   topic?: string       (filter by curriculum_topic or topic_id)
//   difficulty?: string  (easy|medium|hard)
//   type?: string        (task|theory)
//   limit?: number       (default 50, max 200)
//   offset?: number      (default 0)
//   format?: string      (json|latex|markdown, default json)
// Auth: Firebase token (Bearer)
// Response: { tasks: SharedTask[], total: number, limit: number, offset: number }
```

#### `GET /api/export/tasks/:id`
```typescript
// Auth: Firebase token
// Response: SharedTask (single)
// 404 if not found
```

#### `POST /api/export/batch`
```typescript
// Body: { taskIds: string[], format: 'json' | 'slides' | 'curriculum' }
// Auth: Firebase token
// Response: SharedTaskExport
```

#### `GET /api/export/slides/:taskId`
```typescript
// Auth: Firebase token
// Response: SlideDeck (за slides.mismath.net)
// SlideDeck format: види 2.5
```

#### `GET /api/export/curriculum`
```typescript
// Query params:
//   grade?: string
//   track?: string (primary|secondary_general|secondary_math_info|secondary_vocational)
// Auth: Firebase token
// Response: { topics: CurriculumTopicExport[] }
// CurriculumTopicExport: { topic_id, topic_name, grade, tasks: SharedTask[] }
```

### CORS Configuration:
```typescript
const ALLOWED_ORIGINS = [
  'https://math.mismath.net',
  'https://ai.mismath.net',
  'https://slides.mismath.net',
  'http://localhost:3000',
  'http://localhost:5173',
];
```

### Auth Middleware:
```typescript
// Проверка на Firebase token
async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

## 2.5 Slides Format

### НОВ: `src/lib/slidesExport.ts`

```typescript
export interface Slide {
  id: number;
  type: 'title' | 'question' | 'step' | 'answer' | 'summary' | 'geogebra';
  content: string;           // Text content (may contain LaTeX delimiters)
  latex?: string[];          // Extracted LaTeX formulas
  geogebra_commands?: string[];
  notes?: string;            // Teacher notes
  duration_seconds?: number; // Suggested display time
}

export interface SlideDeck {
  title: string;
  slides: Slide[];
  metadata: {
    task_count: number;
    grade?: string;
    topic?: string;
    difficulty?: string;
    generated_at: string;
    source: 'mathdigitizer';
  };
}

// Конвертори
export function taskToSlides(task: MathTask): SlideDeck
export function tasksToSlideDeck(tasks: MathTask[]): SlideDeck
```

**Мапирање задача → слајдови:**
```
Task:
  title → Slide 1 (type: 'title')
  original_text → Slide 2 (type: 'question')
  solution_steps[0] → Slide 3 (type: 'step')
  solution_steps[1] → Slide 4 (type: 'step')
  ...
  solution_steps[n] → Slide n+2 (type: 'answer')
  tags + curriculum → Slide n+3 (type: 'summary')
  geogebra_commands → Slide n+4 (type: 'geogebra', ако постојат)
```

## 2.6 Curriculum Navigator Format

### НОВ: `src/lib/curriculumExport.ts`

```typescript
export interface CurriculumTopicExport {
  topic_id: string;
  topic_name: string;
  grade: string;
  education_track: string;
  outcome_codes: string[];
  tasks: SharedTask[];
  task_count: number;
}

// Групира задачи по curriculum topic
export function tasksByCurriculum(tasks: MathTask[]): CurriculumTopicExport[]

// Филтрира по grade + track
export function filterByGradeAndTrack(
  topics: CurriculumTopicExport[],
  grade?: string,
  track?: string
): CurriculumTopicExport[]
```

## 2.7 Export UI

### НОВ: `src/components/ExportPanel.tsx`

**Props:**
```typescript
interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: MathTask[];        // filtered tasks from Library
}
```

**UI:**
1. **Task selection:**
   - "Export all filtered" / "Select specific" (checkboxes)
   - Count indicator: "X tasks selected"

2. **Format selector:**
   - JSON (generic)
   - LaTeX
   - Markdown
   - Slides (за slides.mismath.net)
   - Curriculum (за ai.mismath.net)

3. **Target app:**
   - Generic download
   - AI Navigator (ai.mismath.net)
   - Slides (slides.mismath.net)

4. **Actions:**
   - "Download" → generates file
   - "Copy API URL" → copies endpoint URL
   - "Open in Navigator" → window.open(ai.mismath.net/import?url=...)
   - "Open in Slides" → window.open(slides.mismath.net/import?url=...)

### ПРОМЕНА: `src/components/Library.tsx`

**Додај:**
- "Export" button во toolbar (до Search/Filters)
- Отвора ExportPanel modal
- Pass filtered tasks

## 2.8 API Документација

### НОВ: `docs/CROSS_APP_API.md`

**Содржина:**
1. Overview + authentication
2. All endpoints со examples
3. SharedTask format specification
4. SlideDeck format specification
5. Integration guide за ai.mismath.net
6. Integration guide за slides.mismath.net
7. Rate limits + error codes
8. CURL examples за секој endpoint

## 2.9 Integration примери

### За ai.mismath.net:
```javascript
// Fetch tasks for grade 7, topic "Алгебра"
const response = await fetch(
  'https://math.mismath.net/api/export/tasks?grade=7&topic=Алгебра&format=json',
  { headers: { Authorization: `Bearer ${firebaseToken}` } }
);
const { tasks } = await response.json();
// tasks е array од SharedTask
```

### За slides.mismath.net:
```javascript
// Fetch slides for a specific task
const response = await fetch(
  'https://math.mismath.net/api/export/slides/task-id-123',
  { headers: { Authorization: `Bearer ${firebaseToken}` } }
);
const slideDeck = await response.json();
// slideDeck.slides е array од Slide
// Секој slide.type: 'title'|'question'|'step'|'answer'|'summary'
```

### За bulk export:
```javascript
// Export multiple tasks as curriculum-organized
const response = await fetch('https://math.mismath.net/api/export/batch', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${firebaseToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    taskIds: ['id1', 'id2', 'id3'],
    format: 'curriculum',
  }),
});
const exportData = await response.json();
```

## 2.10 Testing Checklist

- [ ] /api/health returns 200 with tasks_count
- [ ] /api/export/tasks returns tasks with filters
- [ ] /api/export/tasks/:id returns single task
- [ ] /api/export/batch exports multiple tasks
- [ ] /api/export/slides/:taskId returns valid SlideDeck
- [ ] /api/export/curriculum groups by topic
- [ ] CORS allows ai.mismath.net and slides.mismath.net
- [ ] Auth rejects invalid tokens
- [ ] Auth rejects missing tokens
- [ ] ExportPanel downloads JSON correctly
- [ ] ExportPanel copies API URL
- [ ] Slides format has correct slide types

---

---

# ДЕЛ 3: РЕДОСЛЕД НА РЕАЛИЗАЦИЈА

## Фаза 1: Payment Automation (Ден 1-2)

| Чекор | Задача | Фајл | Статус |
|-------|--------|------|--------|
| 1.1 | Креирај invoicing.ts | src/lib/invoicing.ts | 🔄 |
| 1.2 | Креирај paymentEmails.ts | src/lib/paymentEmails.ts | 🔄 |
| 1.3 | Креирај PaymentModal.tsx | src/components/PaymentModal.tsx | 🔄 |
| 1.4 | Промени Pricing.tsx | src/components/Pricing.tsx | 🔄 |
| 1.5 | Креирај PaymentAdminDashboard.tsx | src/components/PaymentAdminDashboard.tsx | 🔄 |
| 1.6 | Промени BillingDashboard.tsx | src/components/BillingDashboard.tsx | 🔄 |
| 1.7 | Додај route во App.tsx | src/App.tsx | 🔄 |
| 1.8 | Додај nav во Layout.tsx | src/components/Layout.tsx | 🔄 |
| 1.9 | Ажурирај firestore.rules | firestore.rules | 🔄 |
| 1.10 | i18n keys (billing namespace) | src/locales/*/billing.json | 🔄 |

## Фаза 2: Cross-app API (Ден 2-3)

| Чекор | Задача | Фајл | Статус |
|-------|--------|------|--------|
| 2.1 | Креирај sharedTaskFormat.ts | src/lib/sharedTaskFormat.ts | 🔄 |
| 2.2 | Креирај slidesExport.ts | src/lib/slidesExport.ts | 🔄 |
| 2.3 | Креирај curriculumExport.ts | src/lib/curriculumExport.ts | 🔄 |
| 2.4 | Додај API endpoints | server.ts | 🔄 |
| 2.5 | Креирај ExportPanel.tsx | src/components/ExportPanel.tsx | 🔄 |
| 2.6 | Промени Library.tsx | src/components/Library.tsx | 🔄 |
| 2.7 | Креирај CROSS_APP_API.md | docs/CROSS_APP_API.md | 🔄 |
| 2.8 | CORS + auth middleware | server.ts | 🔄 |

## Фаза 3: Верификација (Ден 3)

| Чекор | Задача |
|-------|--------|
| 3.1 | `npx tsc --noEmit` → 0 errors |
| 3.2 | `npx vitest run` → 109/109 |
| 3.3 | Manual testing на payment flow |
| 3.4 | Manual testing на export API |
| 3.5 | Commit + push + PR |

---

---

# ДЕЛ 4: ИДНИ ЧЕКОРИ (по оваа реализација)

## 4.1 Payment надградби
- [ ] PayPal IPN/webhook интеграција
- [ ] Автоматско истекување на payment_intents (30 дена)
- [ ] Subscription renewal reminders (email 7 дена пред истекување)
- [ ] Invoice PDF во Firebase Storage (за download history)

## 4.2 Cross-app надградби
- [ ] WebSocket sync (real-time task updates)
- [ ] Shared Firebase project (директен Firestore пристап)
- [ ] Import API (задачи од Navigator → MathDigitizer)
- [ ] Slide template customization во slides.mismath.net

## 4.3 Curriculum надградби
- [ ] Import останати одделенија (1-6, 8)
- [ ] Гимназија parser (GYM1-NUM-01 формат)
- [ ] batchClassifyTasks backfill за постоечки задачи
- [ ] Curriculum coverage analytics per teacher

---

*Овој план е жив документ — ажурирај го како напредува реализацијата.*

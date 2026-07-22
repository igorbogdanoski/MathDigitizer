# MathDigitizer Pro — User Manual

**Version 4.0 | July 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Core Features](#3-core-features)
4. [Pedagogy Tools](#4-pedagogy-tools)
5. [AI Features](#5-ai-features)
6. [Account & Billing](#6-account--billing)
7. [Tips & Best Practices](#7-tips--best-practices)

---

## 1. Introduction

### What is MathDigitizer Pro?

MathDigitizer Pro is an AI-powered educational platform built specifically for mathematics teachers in North Macedonia. It transforms physical teaching materials — textbook pages, handwritten notes, YouTube video lessons, and PDF documents — into structured, interactive digital math tasks in seconds.

### Who Is It For?

- **Math teachers** (grades 6–12) who want to digitize and enrich their task libraries
- **Schools and institutions** seeking a centralized platform for math instruction
- **Students** who need interactive practice with spaced repetition and AI tutoring

### Key Value Proposition

| Benefit | Detail |
|---------|--------|
| Time savings | ~5 hours saved weekly on task preparation |
| Multimodal extraction | YouTube, PDF, image, handwriting, and text input |
| Pedagogical depth | DOK levels, Bloom's taxonomy, Socratic scaffolding on every task |
| Local readiness | Macedonian math terminology, MK school grading (1–5), local payment |
| Full workflow | From extraction → library → materials → live classroom → grading → analytics |

[Screenshot: Home page hero section]

---

## 2. Getting Started

### 2.1 Registration

1. Navigate to the MathDigitizer Pro homepage.
2. Click **"Start for free"** or **"Sign Up"**.
3. Register using your email address and password, or sign in with your Google account.
4. Upon first login, a 3-step **Onboarding Wizard** introduces the platform's core workflow: extraction, library management, and Pro features.

### 2.2 Login

- Click **"Sign In"** in the top navigation bar.
- Enter your email and password, or use the Google sign-in button.
- Your session persists across visits (Remember Me is enabled by default).

### 2.3 Dashboard Overview

After logging in, the **Dashboard** provides a personalized overview:

- **Statistics panel** — total tasks digitized, completed tasks, accuracy rate, daily streak
- **Mastery by Topics** — radar chart showing proficiency across Algebra, Geometry, Trigonometry, Statistics, Logic, and Analysis
- **Recent Activity** — latest actions (extractions, flashcard sessions, task edits)
- **Ecosystem Quick Access** — shortcut buttons to Extraction, Library, Test Factory, and Billing
- **Billing Health indicator** — shows your current subscription status at a glance

[Screenshot: Dashboard with statistics and quick access tiles]

### 2.4 Language Switching (MK / EN / AL)

MathDigitizer Pro supports three languages:

- **Македонски (MK)** — default
- **English (EN)** — for international users and diaspora
- **Shqip (AL)** — for Albanian-speaking teachers and students

To switch languages, click the **globe icon** in the top navigation bar and select your preferred language. The entire interface updates instantly. Your choice is remembered for future sessions.

[Screenshot: Language switcher dropdown]

---

## 3. Core Features

### 3.1 Extraction Engine

**Navigate to:** Tools → Digitization → Extraction

The Extraction Engine is the platform's centerpiece. It converts any math content source into structured, editable digital tasks with LaTeX formatting.

#### Supported Sources

| Source | How to use |
|--------|-----------|
| **YouTube video** | Paste the video URL. The system extracts the hidden transcript (CC) automatically — no browser extensions needed. |
| **PDF document** | Upload a PDF file (up to 20 MB). Supports old OCR textbooks and scanned materials. |
| **Image** | Upload a photo of a textbook page, whiteboard, or handwritten assignment. |
| **Text** | Paste raw text or a manual transcript directly. |
| **Web page URL** | Paste any URL containing math content. The scraper extracts text and MathJax/KaTeX expressions. |

#### Workflow

1. Select your source type (URL/YouTube, File, or Text tab).
2. Provide the content (paste link, upload file, or type text).
3. Optionally configure **Advanced Parameters**:
   - **Interpretative Level** — Faithful, Clean, Reformulate, Examples, or Summary
   - **Time Range** — for YouTube videos, specify start/end timestamps
   - **Specific Instructions** — e.g., "Focus only on algebra, ignore geometry"
   - **Save to Folder** — assign extracted tasks directly to a named folder
4. Click **"Process"**.
5. Review the extracted tasks. Each task includes:
   - Structured LaTeX math content
   - AI-generated metadata (difficulty, topic, grade level, DOK level)
   - Step-by-step solution
   - Pedagogical enrichment (common mistakes, Socratic questions, teaching strategy)
6. Click **"Save to Library"** to store tasks permanently.

#### Batch Mode

Paste multiple URLs (one per line) to process them sequentially. Progress is shown per link with success/failure counts.

#### From Extraction to Kahoot

After extraction, you can generate a **MathKahoot quiz** directly from the results with one click — the AI creates multiple-choice questions with plausible distractors.

[Screenshot: Extraction Engine with YouTube URL input and results]

---

### 3.2 Smart OCR

**Navigate to:** Tools → Digitization → Smart OCR

The Smart OCR module is specialized for **handwriting recognition**, damaged text, and old Cyrillic textbooks.

#### Features

- **Image/PDF upload** — drag & drop or paste (Ctrl+V) directly
- **Drawing board** — sketch math expressions by hand for recognition
- **Batch processing** — select multiple files at once; all are processed sequentially
- **Crop & extract** — select a region of a larger image to OCR
- **Model selection**:
  - Gemini 3.1 Pro (World-Class accuracy)
  - Gemini 3 Flash (Fast processing)
- **Output language** — Automatic, Macedonian, English, Turkish, or Russian
- **Visualization options** — LaTeX (TikZ), GeoGebra interactive, or AI contextual image
- **Logical Reconstruction** — AI fills in gaps from damaged or unclear text

#### Workflow

1. Upload an image/PDF or draw on the handwriting board.
2. Select your model and output preferences.
3. Click **"OCR Handwriting"** or **"Extract (Crop & OCR)"**.
4. Review the digitized LaTeX output in the preview panel.
5. Optionally generate **Pedagogical Enrichment** (common pitfalls, Socratic questions, modeling scenarios).
6. Save to your Library or copy the LaTeX code.

[Screenshot: Smart OCR with handwriting input and LaTeX output]

---

### 3.3 Library

**Navigate to:** Library

The Library is your central repository for all digitized tasks. It supports powerful organization, search, and batch operations.

#### Task Management

- **Search** — keyword (fuzzy) or **semantic search** (AI-powered meaning-based search)
- **Filters** — by difficulty (Easy/Medium/Hard), grade, topic, DOK level, source type, folder
- **Sorting** — by date added, difficulty, grade, or title (A–Z / Z–A)
- **Folders** — organize tasks into custom folders (e.g., "Exams for 8th grade", "Matura")
- **Tags** — add topic tags for cross-referencing

#### Task Actions

From any task card, you can:

- **View details** — full task text, solution steps, hints, pedagogical metadata
- **Edit** — modify title, text, difficulty, grade, solution steps, hints, and tags
- **Solve Interactively** — open the step-by-step solver
- **Differentiate** — generate 3-level variants
- **Create Flashcard** — add to a flashcard deck
- **Clone (Similar)** — AI generates a methodologically similar task
- **Modernize (Gen-Z)** — reframe in a contemporary context
- **Open in GeoGebra** — visualize with interactive geometry
- **Copy LaTeX** — copy formatted math to clipboard
- **Delete**

#### Bulk Operations

Select multiple tasks to:
- Delete in bulk
- Export (Word/Docx, Markdown, CSV)
- Generate a test or worksheet
- Create a live classroom session
- Generate flashcards
- Create a lesson plan

#### Manual Task Creation

Click **"New Task"** to add tasks manually with full control over title, text, difficulty, grade, folder, tags, solution steps, and hints.

#### Knowledge Model (ToT + CoT)

For any task, access the **Knowledge Model** panel which provides:
- **Tree of Thoughts** — multiple solving paths with critical evaluation
- **Chain of Thought** — detailed methodological step-by-step solution
- **Knowledge Graph** — prerequisite dependencies and horizontal connections

[Screenshot: Library grid view with filters and task cards]

---

### 3.4 Graph Digitizer

**Navigate to:** Tools → Digitization → Graph Digitizer

Convert graphs from textbooks into precise coordinate data with AI-powered pedagogical analysis.

#### Workflow (6 Steps)

1. **Image** — Upload a graph image (JPG, PNG, SVG, BMP, WebP)
2. **Axes** — Configure axis names, min/max values, and scale (linear or logarithmic)
3. **Calibration** — Click 2 known points on the image and enter their real coordinates
4. **Points** — Click on the graph to digitize data points; manage multiple datasets
5. **AI Analysis** — Gemini analyzes the graph type, detects the function, and generates pedagogical questions with DOK levels
6. **Export** — Download as CSV, copy GeoGebra commands, or save directly to your Library

#### AI Analysis Output

- Detected graph type and function
- Grade-level recommendation
- Pedagogical questions categorized by DOK level (Recall, Skill, Strategic, Extended)
- Bloom's taxonomy classification

[Screenshot: Graph Digitizer calibration step with point overlay]

---

### 3.5 Materials Factory

**Navigate to:** Tools → Generation → Materials Factory

*Pro feature* — Transform your task library into professional teaching materials in seconds.

#### Material Types

| Type | Description |
|------|-------------|
| Worksheet | Practice tasks for class or homework |
| Test / Assessment | Graded with points and teacher solutions |
| Task Collection | Comprehensive collection divided by topic and difficulty |
| Interactive Quiz | Live quiz for students (Kahoot style) |
| Presentation | Slides with theory and tasks for class |
| Flashcards | Cards for quick concept review |
| Homework | Tasks for independent work at home |
| Study Guide | Detailed overview of theory and key tasks |

#### Workflow

1. Select tasks from your Library (search and filter to find relevant ones).
2. Choose the material type.
3. Configure settings (language, grade/year).
4. Click **"Generate Material"**.
5. Download as PDF or Word, or print directly.

#### Differentiated Tests

When generating a test, the AI can produce **3 differentiated versions** based on Bloom's Taxonomy levels:
- **Group A** — Knowledge and Comprehension (Level 1)
- **Group B** — Application (Level 2)
- **Group C** — Analysis and Synthesis (Level 3)

Each version includes full solutions for the teacher.

[Screenshot: Materials Factory with task selection and type picker]

---

### 3.6 Flashcards

**Navigate to:** Flashcards

A spaced-repetition learning system (SM-2 algorithm) for long-term retention of math concepts.

#### Creating Cards

- **Manually** — click "New Card" and enter a term/question (front) and definition/answer (back)
- **AI Generator** — enter a topic and the AI generates 5 interactive flashcards automatically
- **From Library tasks** — select tasks and generate flashcards in bulk

#### Study Modes

| Mode | Description |
|------|-------------|
| **Smart Study** | Spaced repetition session. Rate each card: Hard (1), Good (2), or Easy (3). The SM-2 algorithm schedules reviews optimally. |
| **Quiz Mode** | Multiple-choice quiz from your card collection (minimum 4 cards). Score is tracked. |
| **Match Game** | Timed matching game — pair terms with definitions as fast as possible. |

#### Session Features

- Daily review queue based on spaced repetition scheduling
- Progress tracking: cards reviewed, accuracy, time spent
- Card states: New → Learning → Mastered
- Configurable daily limits for new cards and reviews

[Screenshot: Flashcard study session with rating buttons]

---

### 3.7 Interactive Solver

**Navigate to:** Tools → Teaching → Solver (or open from any Library task)

Solve math problems step-by-step with real-time AI verification.

#### How It Works

1. Open a task from the Library and click **"Solve Interactively"**.
2. Enter your first solving step (supports LaTeX notation).
3. Click **"Verify"** — the AI checks your step for correctness.
4. Continue entering steps until the problem is solved.
5. Earn XP for successful interactive solving.

#### Additional Features

- **Request Hint** — get a progressive hint without revealing the answer
- **Draw mode** — sketch your solution step by hand
- **Image upload** — photograph a handwritten step for AI analysis
- **Interactive Graph** — plot functions live with coordinate reading
- **Handwriting analysis** — AI detects errors in handwritten solutions and suggests improvements
- **Reset** — start over from the beginning

[Screenshot: Interactive Solver with step verification feedback]

---

### 3.8 Kahoot Maker

**Navigate to:** Tools → Teaching → Kahoot Maker

Create and host live classroom quizzes that students join from their phones.

#### Creating a Quiz

1. Upload one or more documents or images (textbook pages, worksheets, notes).
2. Optionally customize the prompt (e.g., "Make a 10-question quiz on fractions").
3. Click **"Generate"** — AI creates multiple-choice questions with time limits.
4. Review the draft quiz.
5. Click **"Start Host"** — a unique 6-digit PIN is generated.

#### Running a Live Session

1. Share the PIN with students (they enter it on their devices).
2. Students join the lobby.
3. Start the quiz — questions appear simultaneously on all devices.
4. Students answer within the time limit.
5. View real-time results and rankings.

[Screenshot: Kahoot Maker quiz generation and PIN display]

---

### 3.9 Smart Grader

**Navigate to:** Tools → Analysis → Grading

AI-powered grading of handwritten student work that functions as an expert mentor.

#### Grading Modes

- **Single Task** — photograph one student solution; AI grades it against a selected Library task
- **Batch (Whole Test)** — photograph an entire test page; the algorithm automatically segments, detects all tasks, and grades each one

#### Workflow

1. Select the grading mode.
2. For Single Task: search your Library for the reference task.
3. Upload a photo of the student's handwriting.
4. Enter the student's name.
5. Click **"Grade handwriting"**.

#### AI Output

- **Score** (out of 100) with solving status
- **Bloom's Taxonomy level** assessment
- **Identified errors** — specific mistakes with explanations
- **Formative rubric** — scores for Concept, Execution, and Communication
- **Inspirational AI Mentor feedback**:
  - What was done excellently
  - Where the algorithm breaks (errors)
  - Suggestions for improvement
- **Generate Practice Tasks** — AI creates personalized follow-up exercises targeting weak areas
- **Save to Gradebook** — one-click grade recording

[Screenshot: Smart Grader analysis results with rubric]

---

### 3.10 Task Differentiation

**Navigate to:** Tools → Teaching → Differentiation (or "Differentiate" from any Library task)

Generate three cognitive levels of any task for differentiated instruction.

#### Three Levels

| Level | Purpose | Includes |
|-------|---------|----------|
| **Support** | For students who struggle | Scaffolding (step-by-step), 3 progressive hints (Direction → First step → Almost solution), success criteria, prerequisites, estimated time |
| **Core** | Standard level | The task at grade-level expectations with standard solution |
| **Extension** | For advanced students | Increased complexity, higher DOK/Bloom levels, open-ended challenges |

#### Output Metadata

Each level includes:
- Bloom's taxonomy level
- DOK level
- Pedagogical notes for the teacher
- Full solution
- Estimated completion time

[Screenshot: Differentiation output showing all three levels side by side]

---

## 4. Pedagogy Tools

### 4.1 Pedagogue Command Center

**Navigate to:** Tools → Analysis → Pedagogue (or "Command Center" from any Library task)

An advanced pedagogical analysis suite with four modules:

#### Knowledge Map
Visual graph showing the selected task's position in the broader mathematical knowledge network — prerequisite dependencies, relationship connections, and the primary task node.

#### Cognitive Fingerprint
Perform a **"Cognitive Autopsy"** on any task to decode its multi-dimensional complexity:
- Rigor
- Abstraction
- Connectivity
- Context
- Effort

#### Lesson Architect
AI generates a complete methodological script for teaching the selected task:
- **Socratic Hook** — an opening question to engage students
- **Metaphoric Bridge** — an analogy connecting to prior knowledge
- **Instructional Sequence** — ordered teaching steps

Save scripts for reuse across classes.

#### Socratic Simulation
Practice Socratic redirection with a virtual AI student ("SIM-01"). Choose a persona:
- Struggles with abstraction
- Quick but careless
- Math anxiety

The AI student "solves" the selected task while you practice guiding their intuition without giving away answers.

[Screenshot: Pedagogue Command Center with Cognitive Fingerprint radar]

---

### 4.2 Pedagogue Editor (Neural Copilot)

Accessible from the Library task detail view, the **Neural Pedagogical Copilot** lets you iterate on task architecture using specialized AI protocols:

- **Escalate Rigor** — increases complexity and strategic thinking requirements
- **Evolve Context** — re-frames the task in a contemporary/Gen-Z scenario
- **Synthesize Socratic Guidance** — generates non-giving, context-rich Socratic scaffolds
- **Architect Modeling Path** — creates a real-world mathematical modeling scenario

The editor provides full control over: task title, mathematical narrative (with live LaTeX preview), difficulty, instructional type, Bloom's taxonomy level, DOK level, solution architecture, GeoGebra commands, ontology tags, target misconceptions, Socratic scaffolding, modeling scenarios, instructional strategy, and differentiated support/extension notes.

[Screenshot: Neural Copilot editor with live LaTeX preview]

---

### 4.3 Analytics Dashboard

**Navigate to:** Tools → Analysis → Analytics

*Pro feature* — A cognitive diagnostics laboratory based on the "Adding It Up" framework (National Research Council).

#### Components

- **Cognitive Profiles sidebar** — select a student/subject for in-depth analysis
- **Mastery Radar** — five strands: Conceptual Understanding, Procedural Fluency, Strategic Competence, Adaptive Reasoning, Productive Disposition
- **Cognitive Momentum** — tracks velocity of learning (delta from starting point)
- **Metacognitive Status** — detects optimal assimilation vs. critical alarm states
- **Cognitive Load Assessment** — identifies whether a student is in ZPD (optimal), cognitively underestimated, or overloaded
- **Interactive ZPD Calculator** — simulate scenarios by adjusting average and momentum values; receive recommended pedagogical next steps
- **Longitudinal Cognitive Trajectory** — time-series chart of conceptual understanding, procedural fluency, and momentum
- **Chronological Knowledge Gaps** — granular error analysis with incident counts
- **Class Leaderboard** — global ranking by conceptual mastery and momentum
- **Socratic Intervention Plan** — AI-generated didactic script with methodology engine (exportable as PDF)

[Screenshot: Analytics Dashboard with mastery radar and ZPD calculator]

---

### 4.4 Early Warning System

**Navigate to:** Tools → Analysis → Early Warning

Automatically detects at-risk students based on grade trends, engagement, and performance data.

#### Risk Categories

- **Low risk** — on track
- **Medium risk** — showing early signs of difficulty
- **High risk** — immediate intervention recommended

#### Risk Factors Tracked

- Declining grades
- Low engagement (days since last activity)
- Low average
- Failed tests

#### Interventions

The system recommends specific interventions for each at-risk student and shows the most common recommended interventions across the class.

[Screenshot: Early Warning System with risk distribution chart]

---

### 4.5 Gradebook

**Navigate to:** Tools → Administration → Gradebook

A full grade management system aligned with the Macedonian 1–5 grading scale.

#### Features

- **Grade entry** — add grades per student with category, task title, max/earned points, and feedback
- **Categories** — Test, Homework, Project, Participation, Oral, Other
- **Grade scale** — Insufficient (1) through Excellent (5)
- **Weighted averages** — automatic per-student average calculation
- **Trend indicators** — shows whether each student is improving
- **Filtering** — by term, category, or search by student/task name
- **Summary view** — per-student averages at a glance

#### Export Options

- **CSV** — for spreadsheet import
- **Excel** — formatted workbook
- **PDF** — printable report

[Screenshot: Gradebook table with student averages and trend arrows]

---

## 5. AI Features

### 5.1 Gemini Integration

MathDigitizer Pro is powered by Google's Gemini AI models:

- **Gemini 3.1 Pro** — used for high-accuracy OCR, pedagogical analysis, and complex reasoning
- **Gemini 3 Flash** — used for fast processing when speed is prioritized

AI is embedded throughout the platform: extraction, enrichment, grading, differentiation, quiz generation, Socratic simulation, and intervention planning.

### 5.2 DOK Levels (Depth of Knowledge)

Every task is classified by DOK level:

| Level | Name | Description |
|-------|------|-------------|
| 1 | Recall | Facts, definitions, basic computation |
| 2 | Skill | Procedures, classification, estimation |
| 3 | Strategic | Reasoning, planning, justification |
| 4 | Extended | Complex reasoning, design, multi-step investigation |

### 5.3 Bloom's Taxonomy

Tasks are also mapped to Bloom's cognitive levels:
Remember → Understand → Apply → Analyze → Evaluate → Create

This dual classification (DOK + Bloom) powers the differentiation engine, materials factory, and analytics dashboard.

### 5.4 Pedagogical Insights

For every extracted or created task, the AI generates:
- **Common student mistakes** — typical errors with explanations
- **Socratic questions** — guiding questions for the teacher
- **Teaching strategy** — recommended instructional approach
- **Progressive hints** — 3-level scaffolded help
- **Modern context** — real-world application suggestions
- **Mathematical modeling scenario** — how the concept applies in practice
- **Knowledge graph position** — prerequisites and next-level connections

---

## 6. Account & Billing

### 6.1 Plans

| Plan | Price | Features |
|------|-------|----------|
| **Free** | 0 MKD | 3 digitizations per day, basic PDF extraction, 5 flashcards, community support |
| **Pro Teacher** | 490 MKD/month or 4,900 MKD/year | Unlimited digitizations, AI grading & analysis, unlimited flashcards, advanced pedagogy, priority support, all future features |
| **School** | Custom (by agreement) | Everything in Pro + unlimited teachers, student profiles, centralized administration, training & support, custom integrations |

The annual plan offers the best value (effectively 2 months free).

### 6.2 Payment Methods

- **Bank transfer** — direct deposit to the platform's bank account
- **PayPal** — include your reference code in the payment message
- **Invoice** — available for school plans

### 6.3 Activation Process

1. Go to the **Pricing** page and select your plan (monthly or annual).
2. Note your unique **reference code** (format: `XXXXXXXX-PRO-ANN` or `XXXXXXXX-PRO-MON`).
3. Make the payment via bank transfer or PayPal.
4. **Submit your receipt** on the Pricing page — enter payer name, email, payment channel, and reference code.
5. The team reviews and approves your payment (usually within a few hours).
6. Pro access is activated — you'll see a confirmation on your Dashboard.

### 6.4 Billing Dashboard

Track your subscription status, payment history, and trial period from the Billing page. Status indicators:
- **Pro active** — full access confirmed
- **Pending review** — receipt submitted, awaiting validation
- **In review stage** — receipt checked, in final processing
- **Needs action** — correction or resubmission required
- **No receipt submitted** — choose a plan and submit proof

### 6.5 Free Trial

New users get a **7-day free trial** with full Pro access. No credit card required. Cancel anytime.

---

## 7. Tips & Best Practices

### Extraction

- For YouTube videos without subtitles, use a Chrome extension (e.g., WayinVideo) to copy the transcript, then paste it into the Text tab.
- Use **Batch Mode** to process an entire playlist or multiple exam pages in one session.
- Set **Specific Instructions** to filter content (e.g., "Only extract geometry problems").
- Use the **Time Range** option for long lecture videos to target specific segments.

### Library Organization

- Create folders by grade and topic (e.g., "Grade 8 / Linear Equations").
- Use **semantic search** when you can't remember exact wording — it finds tasks by meaning.
- Generate **semantic embeddings** for your library to enable AI-powered related task matching.
- Regularly tag tasks with topics for better filtering.

### Materials & Assessment

- Select tasks across difficulty levels before generating a test for natural differentiation.
- Use the **Differentiated Test** option to automatically create 3 group versions.
- Export worksheets with the "With solutions (teacher)" option for your answer key, and "Tasks only (student)" for distribution.

### Flashcards

- Study daily — the SM-2 algorithm works best with consistent, short sessions.
- Rate honestly: marking a card "Easy" when you hesitated will show it too rarely.
- Use the **AI Generator** to quickly create cards for new topics before class.

### Grading & Analytics

- Photograph student work in good lighting for best OCR accuracy.
- Use **Batch mode** for whole-test grading — the AI segments multi-task pages automatically.
- Check the **Early Warning System** weekly to catch struggling students early.
- Use the **ZPD Calculator** before planning interventions to calibrate difficulty.

### Classroom Engagement

- Run **Kahoot sessions** at the start of class as a warm-up review.
- Use the **Socratic Simulation** to practice guiding students before difficult lessons.
- Share the **Interactive Solver** with students for homework support.

### General

- Use **Ctrl+K** (Command Palette) to quickly navigate to any tool.
- All extracted content auto-saves to your Library — nothing is lost.
- The platform works in any modern browser; no software installation required.
- Switch to **Dark Mode** in settings for comfortable evening preparation.

---

## Support

For questions, feature requests, or technical issues:
- Check the in-app **Help** section
- Contact support via the **Contact** link in the footer
- School administrators: use the dedicated support channel provided during onboarding

---

*MathDigitizer Pro — Digitize math in seconds. Teach with intelligence.*

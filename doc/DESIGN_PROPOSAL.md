# Thotsakan Statistics — React Redesign Proposal

## 1. Context

Four components exist in this workspace:

| Component | Stack | Role |
|---|---|---|
| `frontend/` | TypeScript · React + Vite | **Active** — UI layer, interactive charts, instant feedback |
| `backend/` | Python · FastAPI | **Active** — authoritative statistical computation |
| `ThotsakanStatistics/` | Python · Gradio | **Read-only reference** — source of `core/` math logic |
| `Try_reflex/` | Python · Reflex | **Read-only reference** — layout prototype |

**Architecture:** React handles the UI; all statistical computation runs in the Python backend. FastAPI wraps the existing Python `core/` (identical to `ThotsakanStatistics/core/`) as the authoritative math engine. The professor verifies correctness by reading `backend/core/` directly.

---

## 2. Visual Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR (sticky, 56px)                                                   │
│  🔱 Thotsakan Statistics   [Home] [Estimation] [Hypothesis] [Regression]     │
│                                                   [Data]  [☀/🌙]            │
├──────────────────────────────────────────────────────────────────────────────┤
│  SUB-HEADER / BREADCRUMB (32px, context-aware)                               │
│  Estimation ▸ Inference ▸ Confidence Interval for Mean                       │
├────────────┬──────────────────────────────────┬───────────────────────────────┤
│  CONTROLS  │       OBSERVATION DECK           │        NOTEBOOK              │
│  (280px)   │         (flex-grow)              │        (320px)               │
│            │                                  │                              │
│  Labeled   │   Primary interactive plot        │  ┌─ LIVE STATS ──────────┐  │
│  sliders   │   (Plotly)                       │  │  x̄ = 5.23            │  │
│  + number  │                                  │  │  CI: [4.81, 5.65]     │  │
│  inputs    │   Secondary visual               │  │  n = 30 · α = 0.05   │  │
│            │   (table / QQ / residuals)        │  └────────────────────────┘  │
│  Mode      │                                  │                              │
│  toggles   │                                  │  ┌─ LESSON ──────────────┐  │
│            │                                  │  │ Contextual teaching   │  │
│  [⟲ Reset] │                                  │  │ note + rendered LaTeX │  │
│  [📥 Export│                                  │  └────────────────────────┘  │
│            │                                  │                              │
│            │                                  │  ┌─ SCRATCHPAD ──────────┐  │
│            │                                  │  │ Markdown + LaTeX      │  │
│            │                                  │  │ student notes area    │  │
│            │                                  │  └────────────────────────┘  │
├────────────┴──────────────────────────────────┴───────────────────────────────┤
│  FOOTER STATUS BAR (24px)                                                    │
│  Dataset: Howell.csv  │  52 rows × 4 cols  │  < 1ms  │  v0.1.2             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

### Frontend (`frontend/src/`)

```
src/
├── main.tsx
├── App.tsx                        # Router + layout shell
│
├── api/                           # Backend fetch client
│   ├── client.ts                  # Base config, error handling, session mgmt
│   ├── descriptive.ts             # Typed wrappers per feature
│   ├── inference.ts
│   ├── hypothesis.ts
│   ├── regression.ts
│   └── types.ts                   # TS types matching backend Pydantic schemas
│
├── layout/
│   ├── Header.tsx                 # Sticky nav bar + tab buttons
│   ├── SubHeader.tsx              # Breadcrumb ribbon (per-tab)
│   ├── LabBench.tsx               # 3-panel resizable container
│   ├── LogoBar.tsx                # App branding
│   └── Footer.tsx                 # Status bar
│
├── features/                      # Each tab provides 3 panel components
│   ├── home/
│   ├── data/
│   ├── probability/
│   │   └── common/                # 12 distributions
│   └── estimation/
│       ├── descriptive/
│       ├── inference/
│       └── graphical/             # Planned
│
├── components/                    # Reusable atoms
│   ├── DualInput.tsx              # Slider + number input (synced)
│   ├── CollapsedRail.tsx          # Collapsed sidebar indicator
│   ├── DragHandle.tsx             # Panel resize handle
│   └── ExportMenu.tsx             # CSV/PDF/PNG export
│
├── hooks/                         # Feature API orchestration (debounced, AbortController)
│   ├── useDistribution.ts         # Calls /api/probability/compute
│   ├── useNormalPDF.ts            # Calls /api/probability/normal-pdf
│   ├── useResizablePanel.ts
│   ├── useContainerBreakpoint.ts
│   └── useSidebarKeyboard.ts
│
├── context/
│   └── DataContext.tsx             # Global dataset state + session ID
│
└── utils/
    ├── exportCSV.ts, exportPDF.ts, exportPNG.ts
    └── parseFile.ts
```

### Backend (`backend/`)

```
backend/
├── main.py                        # FastAPI app, CORS, route mounting
├── core/                          # Pure math (estimation/ IDENTICAL to ThotsakanStatistics/core/)
│   ├── data_stats.py
│   ├── probability/               # NEW subpackage (not in ThotsakanStatistics/core/)
│   │   └── common_distributions/  # distributions.py, normal_pdf.py
│   ├── estimation/
│   │   ├── descriptive.py
│   │   ├── graphical_analysis.py
│   │   └── inference/             # ci_*.py, pi_*.py, estimators, likelihood
│   ├── hypothesis_testing/        # subpackage
│   └── linear_regression/         # subpackage
├── services/                      # Orchestration (from controllers/)
│   ├── descriptive.py
│   ├── inference.py
│   ├── hypothesis.py
│   └── regression.py
├── api/
│   ├── routes/                    # Thin FastAPI endpoints
│   ├── schemas/                   # Pydantic request/response models
│   └── deps.py                    # Shared deps (session lookup)
├── sessions/
│   └── store.py                   # In-memory dict + TTL auto-cleanup
├── requirements.txt
└── tests/
```

---

## 4. Tab → Panel Slot Pattern

Each tab exports three components that slot into the fixed `LabBench` layout. The layout itself never changes — only the content inside each panel swaps:

```tsx
// Example: tabs/estimation/inference/index.ts
export { InferenceControls }     // → ControlPanel slot
export { InferenceObservation }  // → ObservationPanel slot
export { InferenceNotebook }     // → NotebookPanel slot
```

```tsx
// LabBench.tsx wires them together:
<ControlPanel>   <ActiveTab.Controls />   </ControlPanel>
<ObservationPanel> <ActiveTab.Observation /> </ObservationPanel>
<NotebookPanel>  <ActiveTab.Notebook />  </NotebookPanel>
```

---

## 5. DualInput Component Pattern

Every parameter slider uses the same synced input pair:

```
┌──────────────────────────────────┐
│  Mean (μ)                        │
│  <────────────●────────────>     │  ← slider (coarse adjustment)
│  [ 5.23 ]                        │  ← text input (fine adjustment)
└──────────────────────────────────┘
```

Both stay synced — typing into the number field moves the slider and vice versa.

---

## 6. User Flow

```
App loads (Home tab)
    │
    ▼
Student selects tab  ──────────────────────────────► Header nav
    │
    ▼
Sub-tab appears ──────────────────────────────────► Breadcrumb ribbon
    │
    ▼
LabBench loads (Controls / Observation / Notebook)
    │
    ├── Student moves a slider
    │       └── Plot + stats update in < 100ms
    │
    ├── Student reads lesson card + rendered formula
    │
    ├── Student types notes in scratchpad (Markdown + LaTeX)
    │
    └── Student exports PNG / copy stats / reset defaults
```

---

## 7. Implementation Phases

### Completed (Frontend-only era)

| Phase | Deliverable | Status |
|---|---|---|
| **1** | Header + LabBench 3-panel layout + DualInput + Normal PDF tab | Done |
| **2** | Notebook panel — StatCard, LessonCard, MathBlock | Done |
| **3** | Data tab — CSV upload + DataTable preview | Done |
| **4** | 12 common probability distributions (PMF/PDF/CDF) | Done |
| **5** | Descriptive statistics (Web Worker) | Done |

### Current (Hybrid migration — see `doc/migration_plan.md` for details)

| Phase | Deliverable | Priority |
|---|---|---|
| **0** | Backend skeleton: FastAPI + session store + Vite proxy + `concurrently` | Foundation |
| **1** | Descriptive stats: migrate Web Worker → backend API | First |
| **2** | Inference: CI/PI/confidence regions via backend services | Second |
| **3** | Graphical analysis: ECDF, advanced histograms | Third |
| **4** | Hypothesis testing: new React UI + backend API | Fourth |
| **5** | Linear regression: formula support + visualization | Fifth |
| **6** | Distributions: Python backend for all 12 distributions + normal PDF (primary compute) | Done |
| **7** | Polish: i18n, export improvements, custom distributions, approximations | Last |

---

## 8. Performance Budget

| Interaction | Target |
|---|---|
| Slider → plot update | < 100ms |
| Tab switch | < 200ms (lazy loaded) |
| Initial page load | < 2s |
| Math render (KaTeX) | < 50ms |

---

## 9. Theme

| Element | Decision |
|---|---|
| Default mode | **Dark** (lab instrument aesthetic) |
| Primary accent | Indigo / violet |
| Font — UI | Inter |
| Font — math | KaTeX default |
| Panel borders | Subtle (`#1f2937`), no heavy cards |
| Border radius | Small (`8px`) — technical feel |
| Panel dividers | Draggable resize handles |

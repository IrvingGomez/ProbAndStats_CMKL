# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Thotsakan Statistics** — an interactive statistics laboratory for Thai engineering students. Philosophy: "Stop Calculating. Start Simulating." — students manipulate variables and observe behavior rather than applying formulas.

**Hybrid architecture:** React/TypeScript frontend (`frontend/`) + Python/FastAPI backend (`backend/`). The frontend handles UI, interactivity, and instant visual feedback; the backend is the authoritative source for all statistical computation (scipy, statsmodels, pingouin). The professor verifies the Python `core/` math directly.

### Repository Layout

```
thotsakan-stats/
├── frontend/              # React + Vite + TypeScript (UI layer)
├── backend/               # FastAPI + Python (computation layer)
│   ├── core/              # Pure math — identical to ThotsakanStatistics/core/
│   ├── services/          # Orchestration (cleaned from controllers/)
│   ├── api/               # FastAPI routes + Pydantic schemas
│   └── sessions/          # In-memory dataset store with TTL
├── ThotsakanStatistics/   # Original Gradio app (READ-ONLY reference)
├── Try_reflex/            # Legacy Reflex prototype (READ-ONLY reference)
└── doc/
```

`ThotsakanStatistics/` and `Try_reflex/` are kept for reference during migration. Do not modify them.

## Commands

### Frontend (from `frontend/`)

```bash
npm run dev        # Vite dev server with fast refresh
npm run build      # tsc (type check) + vite build (production)
npm run preview    # Preview production build
npm run test       # Vitest (run once)
npm run test:ui    # Vitest interactive UI
```

### Backend (from `backend/`)

```bash
pip install -r requirements.txt   # Install dependencies
uvicorn main:app --reload         # FastAPI dev server (port 8000)
pytest                            # Run tests
```

### Both (from project root)

```bash
npm run dev        # Runs frontend + backend concurrently (via concurrently)
```

No linting is configured yet (no ESLint/Prettier).

## Architecture

### Zero Frontend Math

All statistical computation runs in the Python backend. Hooks call API endpoints; the frontend renders results. Interactive slider-driven features use ~250ms debounced API calls with `AbortController` for stale-response cancellation, and show a loading skeleton during the request.

```
User drags slider
  → 250ms debounce fires
  → Previous in-flight request aborted (AbortController)
  → POST /api/... to Python backend
  → Python returns result
  → React renders authoritative result
```

**There is no JS approximation layer for authoritative results.** `core/` is the only place where statistics are verified.

One exception: `frontend/src/math/` holds a hand-rolled, provisional-only preview used by the 12-distributions tab (`useDistribution`) so slider drags render instantly instead of freezing for the debounce + round trip. Its output is marked `provisional: true` and is never trusted — the debounced backend call always follows and overwrites it. `core/` remains the only verified math.

### Backend Architecture

```
backend/
├── core/                  # Pure math (IDENTICAL to ThotsakanStatistics/core/)
│   ├── data_stats.py      # Data loading and inspection
│   ├── probability/
│   │   ├── common_distributions/  # distributions.py, normal_pdf.py
│   │   ├── custom_distributions/  # stub
│   │   └── approximation/         # stub
│   ├── estimation/
│   │   ├── descriptive.py         # + compute_histogram, compute_boxplot_data
│   │   ├── graphical_analysis.py  # + JSON compute block (histogram/PMF/ECDF, KDE, rug, normal, bands)
│   │   └── inference/             # ci_*.py, pi_*.py, estimators, likelihood,
│   │                              #   confidence_regions.py (+ compute_confidence_regions_data)
│   ├── hypothesis_testing/        # was hypothesis_tests.py
│   │                              #   __init__.py is byte-identical to the professor's file
│   │                              #   + rejection_region.py (α, critical values, JSON output)
│   │                              #   + tables.py (plot-free ANOVA; see pingouin note below)
│   └── linear_regression/         # was linear_regression.py
│
├── services/              # Orchestration (from controllers/)
│   ├── descriptive.py     # Thin: validate → call core
│   ├── inference.py       # Thick: picks distribution, composes CI/PI
│   ├── hypothesis.py      # Medium: dispatch + group materialization
│   └── regression.py      # Medium: parsing + delegation (NOT BUILT YET)
│
├── api/
│   ├── routes/            # FastAPI endpoints (~10 lines each)
│   ├── schemas/           # Pydantic request/response models
│   └── deps.py            # Shared dependencies (session lookup, etc.)
│
├── sessions/
│   └── store.py           # In-memory dict + TTL auto-cleanup
│
├── main.py                # FastAPI app, CORS, mount routes
└── requirements.txt       # scipy, statsmodels, pingouin, fastapi, uvicorn
```

**Request flow:** `React hook → POST /api/... → api/routes/ → services/ → core/ → JSON response`

**Key rules:**
- `core/` must NOT depend on services, api, or sessions
- `core/` is kept identical to `ThotsakanStatistics/core/` so the professor can verify the math
- `services/` must NOT import numpy, scipy, or statsmodels — validate, call core, map schema only
- Rounding is presentation-level — core keeps full numerical precision
- Datasets are held server-side in memory, keyed by session ID with TTL auto-cleanup

### Frontend Architecture

#### The 3-Panel "LabBench" Pattern

Every feature tab slots three components into a shared layout (`src/layout/LabBench.tsx`):

```
┌────────────────────────────────────────────┐
│  Header (LogoBar + nav tabs + SubHeader)   │
├──────────────┬──────────────┬──────────────┤
│  *Controls   │ *Observation │  *Notebook   │
│  (left,      │  (center,    │  (right,     │
│  ~280px)     │  flex-grow)  │  ~320px)     │
│  Sliders,    │  Plotly      │  Stats,      │
│  selects     │  charts      │  explanations│
├──────────────┴──────────────┴──────────────┤
│  Footer (status bar)                       │
└────────────────────────────────────────────┘
```

Panels are resizable (drag handles), collapsible, and persist widths to `localStorage` key `thotsakan-sidebar-state`. Auto-collapse at 768px (both sidebars) / 1024px (right sidebar).

#### Feature Organization

```
src/
├── api/                             # backend fetch client — one file per feature area.
│                                    # There is no shared client.ts or types.ts: each file
│                                    # declares its own BASE_URL and its own TS interfaces.
│   ├── descriptive.ts               # Typed wrappers per endpoint
│   ├── inference.ts
├── features/
│   ├── home/                        # Full-width landing page
│   ├── data/                        # CSV upload + inspection
│   ├── probability/
│   │   └── common/                  # 12 distributions (PMF/PDF/CDF)
│   └── estimation/
│       ├── descriptive/             # Stats tables, histograms, box plots
│       ├── inference/               # CI / PI / confidence regions
│       └── graphical/               # Histogram / empirical PMF / ECDF + overlays
├── hooks/                           # Feature-local computation + API orchestration
├── components/                      # Reusable UI atoms
├── context/                         # Global state (DataContext)
├── layout/                          # LabBench, Header, Footer, etc.
├── utils/                           # Export helpers, file parsing
└── workers/                         # (empty — workers deleted, all computation in backend)
```

Each feature folder follows the naming convention: `*Controls.tsx`, `*Observation.tsx`, `*Notebook.tsx`. `App.tsx` wires the active tab's three components into `LabBench`.

#### State Management

**Global (DataContext):** `src/context/DataContext.tsx` — `useReducer` managing dataset reference (session ID), filters, column classifications, and display precision. Access via `useData()`.

**Feature-local:** Each tab's computation lives in a dedicated hook (`useDistribution`, `useGraphicalTabState`). Hooks fire debounced API calls and expose `{ result, isLoading/isComputing, error }` — no local math.

**API client:** `src/api/` contains typed fetch wrappers. Hooks call these instead of doing heavy math locally.

**UI persistence:** `useLocalStorageState` wraps `useState` with schema validation on load.

#### Key Hooks

| Hook | What it does |
|------|-------------|
| `useDistribution()` | Calls `/api/probability/compute`; returns `{ result, isLoading, error }` |
| `useGraphicalTabState()` | Calls `/api/graphical/compute`; debounced live path for display toggles, explicit `run()` for estimator- and bootstrap-backed overlays |
| `useResizablePanel()` | Drag logic for panel width |
| `useContainerBreakpoint()` | Viewport-based auto-collapse |
| `useSidebarKeyboard()` | Keyboard shortcuts for sidebar toggle |

#### DualInput Component

`src/components/DualInput.tsx` is used everywhere for parameter controls:
- Slider → immediate commit; Text → 400ms debounce + blur commit
- Arrow keys for fine adjustment; internal text state decoupled from committed value
- Clamping + rounding to step precision

#### Visualization

Plotly charts in Observation components are lazy-loaded with `React.lazy` + `Suspense` to avoid blocking initial render (plotly-vendor chunk is large). Bundle is split into `react-vendor`, `plotly-vendor`, and `math-vendor` chunks. Chunk size warning threshold: 1600 KB.

#### Math Rendering

KaTeX for static formula display; MathLive for interactive math input. Custom element types declared in `src/custom-elements.d.ts`.

## Performance Targets

| Interaction | Target |
|---|---|
| Slider → debounce fires | ~250ms after last move |
| Backend result (distributions, PDF) | < 500ms (typical), < 2s (bootstrap) |
| Tab switch | < 200ms (lazy loaded) |
| Initial page load | < 2s |

## Migration Status

Porting features from `ThotsakanStatistics/` (Gradio) to the React + FastAPI hybrid. See `doc/migration_plan.md` for the phased roadmap.

| Feature | Frontend | Backend | Status |
|---|---|---|---|
| Home tab | Done | N/A | Complete |
| Data tab | Done (local parsing) | Done (upload route + session store) | Partial — frontend not yet wired to backend sessions |
| 12 common distributions | Done (API) | Done | Complete |
| Descriptive statistics | Done (API) | Done | Complete |
| Normal PDF / CI | Retired (backend route kept) | Done | Superseded by Graphical Analysis |
| Inference (CI/PI/regions) | Done (API) | Done | Complete |
| Graphical analysis | Done (API) | Done | Complete |
| Hypothesis testing | Done (API) | Done | Complete — 4 tests, plus α / critical values / verdict |
| Linear regression | Not started | Stub (`core/linear_regression/` empty) | Not started |

## Documentation

- `doc/DESIGN_PROPOSAL.md` — component architecture, tab/panel slot pattern, DualInput spec, implementation phases
- `doc/identity.md` — brand philosophy, UX pillars, what the app is and is NOT
- `doc/context.md` — high-level workspace onboarding, architecture layers, data flow
- `doc/migration_plan.md` — phased migration roadmap from Gradio to React + FastAPI

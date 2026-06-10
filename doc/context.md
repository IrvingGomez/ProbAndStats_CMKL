# Project Context: Thotsakan Statistics

## 1) What this project is

**Thotsakan Statistics** is an interactive statistics laboratory application built by **Himmapan Lab** for engineering education.

- License: **MIT**
- Frontend: **React + TypeScript + Vite** (`frontend/`)
- Backend: **FastAPI + Python** (`backend/`)
- Original reference: **Gradio app** (`ThotsakanStatistics/`, read-only)

Primary goals:
1. Help students/instructors run statistics workflows interactively.
2. Provide a structured codebase for student contributors.
3. Let the professor verify statistical correctness by reading Python `core/`.

---

## 2) Current functional scope

### Implemented in React frontend:

- **Home tab**: landing page with navigation.
- **Data tab**: CSV/TSV upload, preview, column reclassification, filtering.
- **Probability tab → Common Distributions**: 12 interactive distributions (PMF/PDF/CDF) with query operations.
- **Estimation tab → Descriptive**: summary statistics, histograms, box plots.
- **Estimation tab → Inference**: Normal PDF with CI visualization.

### Implemented in Python (ThotsakanStatistics/) — awaiting migration to backend API:

- **Descriptive statistics**: 7 central tendency measures, 8 dispersion measures, shape stats, weighted/trimmed/Winsorized variants.
- **Statistical inference**: CI/PI for mean, median, deviation (analytic + bootstrap), confidence regions, likelihood.
- **Graphical analysis**: histograms with overlays, empirical PMF, ECDF with KS bands.
- **Hypothesis testing**: one-sample t-test, two-sample t-test (Welch), Bartlett/Levene variance tests, one-way ANOVA + Tukey HSD.
- **Linear regression**: simple + multiple OLS, formula support (statsmodels), CI/PI bands, residual analysis.

### Not yet implemented anywhere:

- **Probability tab → Custom distributions**: user-defined PDF/CDF.
- **Probability tab → Approximations**: normal→binomial, CLT demonstration.

---

## 3) Architecture at a glance

The project is a **hybrid React + FastAPI** application:

```
React Frontend                          Python Backend
┌─────────────────┐                    ┌──────────────────┐
│  UI Components   │  ──POST /api/──►  │  api/routes/      │
│  Hooks (API      │  ◄──JSON─────── │  api/schemas/      │
│   orchestration) │                    │       │           │
│                  │                    │  services/        │
│  api/ client     │                    │  (orchestration)  │
│                  │                    │       │           │
│                  │                    │  core/            │
│                  │                    │  (pure math)      │
└─────────────────┘                    └──────────────────┘
```

### Dependency direction (backend):

`api/routes/ → services/ → core/`

- **core/** must NOT depend on services, api, or sessions.
- **core/** is kept identical to `ThotsakanStatistics/core/` — the professor reads this.
- Rounding is presentation-level; core keeps full numerical precision.

### The "Zero Frontend Math" pattern:

All statistical computation runs in the Python backend. The frontend performs no math — hooks fire a debounced API call (with AbortController to cancel stale requests) and render a loading skeleton while the request is in flight. When the response arrives, the result renders. This applies uniformly to both slider-driven and button-triggered features.

---

## 4) Key architectural rules (project doctrine)

- Keep dependency flow one-way: **API → Services → Core**.
- **Core must not depend on API/services/sessions**.
- **Rounding is presentation-level**; core keeps full numerical precision.
- Estimator/strategy choices must be explicit (no silent overrides).
- Reproducibility is required for random procedures (seed-aware behavior).
- Datasets are held server-side in memory with TTL auto-cleanup.

---

## 5) Runtime and dependencies

### Frontend (`frontend/`):
- React 18+, TypeScript, Vite
- Plotly (lazy-loaded), KaTeX, MathLive
- `concurrently` (dev: runs frontend + backend together)

### Backend (`backend/`):
- FastAPI, uvicorn
- numpy, pandas, scipy, statsmodels, pingouin, matplotlib, seaborn

### Dev workflow:
```bash
npm run dev   # from project root — starts both Vite + uvicorn via concurrently
```

Vite proxies `/api/*` requests to FastAPI (port 8000). In production, FastAPI serves the built React static files.

---

## 6) How data flows through the app

### Dataset lifecycle:
1. Student uploads CSV in React Data tab.
2. File is sent to `POST /api/data/upload`.
3. Backend parses with pandas, stores in memory keyed by session ID.
4. React receives session ID + column metadata + preview rows.
5. Subsequent API calls reference the session ID — no repeated data transfer.
6. Sessions auto-expire after 30 minutes of inactivity.

### Computation flow:
1. User adjusts controls (sliders, selects) in React.
2. A 250ms debounce fires after the last change.
3. Any previous in-flight request is aborted (AbortController).
4. The API call fires to the backend; the UI shows a loading skeleton.
5. API route validates with Pydantic → calls service → service calls core.
6. Core returns raw results with full precision; service formats → API returns JSON.
7. React renders the result into the UI.

---

## 7) Testing and quality posture

### Backend:
- `core/` has guardrail tests (import integrity, no rounding in core).
- Statistical correctness tests are planned per migration phase.

### Frontend:
- Vitest for unit tests.

---

## 8) Repository maturity snapshot

- Architecture is early-stage with strong documentation/governance emphasis.
- Frontend UI is functional for probability and basic estimation.
- Backend API is being set up — `core/` math exists, API layer is new.
- Migration from Gradio → React + FastAPI is in progress (see `doc/migration_plan.md`).

---

## 9) Fast onboarding checklist

1. Read `doc/identity.md` (project philosophy).
2. Read `doc/migration_plan.md` (current phase and priorities).
3. Frontend: `cd frontend && npm install && npm run dev`
4. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
5. Or both: `npm run dev` from project root.

# Migration Plan: ThotsakanStatistics → React + FastAPI

This document tracks the phased migration from the original Gradio-based `ThotsakanStatistics/` app to the hybrid React frontend + FastAPI backend architecture.

## Guiding Principles

1. **`core/` is sacred.** Copied identically from `ThotsakanStatistics/core/`. The professor verifies the math by reading this code. Do not modify it during migration.
2. **One feature at a time.** Each phase delivers a working feature end-to-end (API route → React hook → UI).
3. **Zero frontend math.** All statistical computation runs in the Python backend. Hooks fire debounced API calls; no JS approximations.
4. **Old code stays for reference.** `ThotsakanStatistics/` and `Try_reflex/` remain read-only until migration is complete.

---

## Phase 0: Backend Skeleton

**Goal:** Set up the FastAPI project, session store, and dev tooling so subsequent phases can focus purely on features.

### Deliverables

- [x] `backend/` directory structure: `main.py`, `core/`, `services/`, `api/`, `sessions/`
- [x] Copy `ThotsakanStatistics/core/` → `backend/core/` (identical, no changes)
- [x] `sessions/store.py` — in-memory dict keyed by session ID, TTL auto-cleanup (30 min default)
- [x] `main.py` — FastAPI app with CORS (allow `localhost:5173`), health check endpoint
- [x] `api/routes/data.py` — `POST /api/data/upload` (accept CSV, store in session, return metadata)
- [x] `api/deps.py` — `get_session_data()` dependency (looks up dataset by session ID)
- [x] `requirements.txt` — fastapi, uvicorn, pandas, numpy, scipy, statsmodels, pingouin, matplotlib, seaborn
- [x] Vite proxy: configure `vite.config.ts` to proxy `/api/*` → `http://localhost:8000`
- [x] Install `concurrently` as dev dep; root `package.json` with `npm run dev` running both servers
- [x] Smoke test: upload CSV from React Data tab → backend stores it → returns column info

### Source files to reference
- `ThotsakanStatistics/core/data_stats.py` — data loading logic
- `ThotsakanStatistics/state/app_state.py` — session state shape

---

## Phase 1: Descriptive Statistics

**Goal:** Replace the Web Worker with a backend API call. First real end-to-end feature through the full stack.

### Deliverables

- [x] `api/schemas/descriptive.py` — Pydantic models for request (session_id, column, quantiles, trim/winsor options) and response (stats table as JSON)
- [x] `services/descriptive.py` — clean up from `controllers/estimation/descriptive_controller.py` (remove Gradio `state` dependency, use session store instead)
- [x] `api/routes/descriptive.py` — `POST /api/descriptive/compute`
- [x] `frontend/src/api/descriptive.ts` — typed fetch wrapper
- [x] Update `useDescriptiveStats` hook: call API instead of Web Worker, keep loading/error states
- [x] Verify: results match original Gradio app for test datasets

### Source files to reference
- `ThotsakanStatistics/controllers/estimation/descriptive_controller.py`
- `ThotsakanStatistics/core/estimation/descriptive.py`

---

## Phase 2: Statistical Inference (CI / PI / Confidence Regions)

**Goal:** Port the most complex orchestration layer. This validates that the `services/` pattern works for multi-step computations.

### Deliverables

- [x] `services/inference.py` — clean up from `controllers/estimation/inference_controller.py`
  - `run_confidence_intervals()` — orchestrates mean/median/deviation CIs (analytic + bootstrap)
  - `run_prediction_intervals()` — orchestrates mean/median/IQR/bootstrap PIs
  - `run_confidence_regions()` — likelihood contour plots
  - `get_available_estimators()` — returns valid estimator choices for given data
- [x] `api/schemas/inference.py` — request/response models for CI, PI, regions, estimator options
- [x] `api/routes/inference.py` — endpoints: `/api/inference/ci`, `/api/inference/pi`, `/api/inference/regions`, `/api/inference/estimators`
- [x] New React feature UI: `features/estimation/inference/` — Controls for estimator selection, alpha, bootstrap toggle; Observation for interval visualization; Notebook for CI/PI tables
- [x] `frontend/src/api/inference.ts` — typed fetch wrappers

### Source files to reference
- `ThotsakanStatistics/controllers/estimation/inference_controller.py` (314 lines of orchestration)
- `ThotsakanStatistics/core/estimation/inference/` (all ci_*.py, pi_*.py, estimators.py, confidence_regions.py, likelihood.py)
- `ThotsakanStatistics/ui/tabs/estimation/inference_tab.py` (UI reference)

---

## Phase 3: Graphical Analysis

**Goal:** Add ECDF, advanced histogram overlays, and empirical PMF — visualizations that build on top of inference results.

### Deliverables

- [ ] `services/graphical.py` — clean up from `controllers/estimation/graphical_controller.py`
- [ ] `api/routes/graphical.py` — endpoints returning Plotly-compatible JSON (not matplotlib figures)
- [ ] Convert `core/estimation/graphical_analysis.py` matplotlib output → Plotly JSON in the service layer
- [ ] New React feature UI: `features/estimation/graphical/` — ECDF, histogram with KDE/normal/CI/PI overlays, empirical PMF
- [ ] `frontend/src/api/graphical.ts`

### Note on matplotlib → Plotly
The `core/` graphical functions return matplotlib figures. Since the frontend uses Plotly, the service layer must convert. Options:
1. Extract data from matplotlib figure objects → build Plotly traces (preferred)
2. Or add parallel Plotly-native functions in services/ (if extraction is too fragile)

### Source files to reference
- `ThotsakanStatistics/controllers/estimation/graphical_controller.py`
- `ThotsakanStatistics/core/estimation/graphical_analysis.py`
- `ThotsakanStatistics/ui/tabs/estimation/graphical_tab.py`

---

## Phase 4: Hypothesis Testing

**Goal:** New React UI + backend API for all 5 test types. This is the first tab that doesn't exist in React at all yet.

### Deliverables

- [ ] `services/hypothesis.py` — clean up from `controllers/hypothesis_controller.py`
- [ ] `api/schemas/hypothesis.py` — request/response for each test type
- [ ] `api/routes/hypothesis.py` — `POST /api/hypothesis/test` (dispatches by test type)
- [ ] New React feature UI: `features/hypothesis/`
  - `HypothesisControls.tsx` — test type selector, μ₀ input, group selection, alternative hypothesis
  - `HypothesisObservation.tsx` — sampling distribution plot, p-value shading, mirror plots
  - `HypothesisNotebook.tsx` — result table, test interpretation
- [ ] `frontend/src/api/hypothesis.ts`

### Test types to implement
1. One-sample Student's t-test
2. Two-sample Student's t-test (with Welch correction option)
3. Equal variance tests (Bartlett / Levene)
4. One-way ANOVA
5. Tukey HSD post-hoc (paired with ANOVA)

### Source files to reference
- `ThotsakanStatistics/controllers/hypothesis_controller.py`
- `ThotsakanStatistics/core/hypothesis_tests.py` (612 lines)
- `ThotsakanStatistics/ui/tabs/hypothesis_testing_tab.py`

---

## Phase 5: Linear Regression

**Goal:** Most complex UI — formula editor, multiple plot types, CI/PI bands on regression lines.

### Deliverables

- [ ] `services/regression.py` — clean up from `controllers/linear_regression_controller.py`
- [ ] `api/schemas/regression.py`
- [ ] `api/routes/regression.py` — `POST /api/regression/fit`
- [ ] New React feature UI: `features/regression/`
  - `RegressionControls.tsx` — dependent/independent var selection, formula toggle (MathLive), confidence level, graph options
  - `RegressionObservation.tsx` — regression line + CI/PI bands, observed vs. predicted
  - `RegressionNotebook.tsx` — model summary (HTML from statsmodels), parameter table
- [ ] `frontend/src/api/regression.ts`
- [ ] Handle matplotlib figure conversion (same pattern as Phase 3)

### Source files to reference
- `ThotsakanStatistics/controllers/linear_regression_controller.py`
- `ThotsakanStatistics/core/linear_regression.py` (366 lines)
- `ThotsakanStatistics/ui/tabs/linear_regression_tab.py`

---

## Phase 6: Distribution Integrity Backend

**Goal:** Add Python backend for all 12 distributions and normal PDF — backend is now the primary (and only) computation source.

### Deliverables

- [x] `core/probability/common_distributions/distributions.py` — 12 distribution functions using scipy.stats (PDF/PMF, CDF, quantiles, moments)
- [x] `core/probability/common_distributions/normal_pdf.py` — normal PDF data for the CI visualization
- [x] `services/probability.py` — thin wrapper
- [x] `api/routes/probability.py` — `POST /api/probability/compute`, `POST /api/probability/normal-pdf`
- [x] `frontend/src/api/probability.ts`
- [x] `useDistribution` hook: calls `/api/probability/compute`; no JS math
- [x] `useNormalPDF` hook: calls `/api/probability/normal-pdf`; no JS math

### Note
`core/probability/` is new — it does not exist in the original `ThotsakanStatistics/core/`. It lives in its own subpackage, clearly separate from `estimation/`.

---

## Phase 7: Polish

- [ ] Custom distribution builder (Probability tab)
- [ ] Distribution approximations (binomial→normal, CLT)
- [ ] Thai/English i18n
- [ ] Export improvements
- [ ] Performance profiling and optimization
- [ ] Production deployment config (FastAPI serves static React build)

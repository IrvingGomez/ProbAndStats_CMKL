# Folder Duties

Quick reference: what each folder is responsible for and what it must NOT do.

---

## Frontend (`frontend/src/`)

### `api/`
**Duty:** Typed fetch wrappers that talk to the Python backend.  
Each file maps to one backend feature area (`descriptive.ts`, `inference.ts`, `graphical.ts`).  
**Must NOT:** Compute statistics — only send requests and return typed responses.

| File | Talks to |
|------|----------|
| `client.ts` | Base config, error handling for all requests |
| `descriptive.ts` | `POST /api/descriptive/…` |
| `inference.ts` | `POST /api/inference/…` |
| `graphical.ts` | `POST /api/graphical/…` |
| `probability.ts` | `POST /api/probability/…` |

---

### `features/`
**Duty:** One sub-folder per product tab. Each tab owns exactly three components:

| Component | Duty |
|-----------|------|
| `*Controls.tsx` | User inputs — sliders, dropdowns, DualInput |
| `*Observation.tsx` | Plotly chart(s) — the visual output |
| `*Notebook.tsx` | Numbers, formulas (KaTeX), written explanation |

Sub-folders:

| Folder | Tab |
|--------|-----|
| `home/` | Landing page (no LabBench panels) |
| `data/` | CSV upload and column inspection |
| `probability/common/` | 12 common distributions (PMF/PDF/CDF) |
| `estimation/descriptive/` | Descriptive stats table, histogram, box plot |
| `estimation/inference/` | Normal PDF with CI/PI shading |
| `estimation/graphical/` | Graphical analysis (Q-Q, etc.) |

Each feature folder may also contain a `use*TabState.ts` hook that is private to that tab.

---

### `hooks/`
**Duty:** Feature-level API orchestration.  
Hooks fire debounced API calls (250ms, with AbortController for stale-response cancellation) and expose `{ result, isLoading, error }`. No local math.  
**Must NOT:** Render JSX.

| Hook | Duty |
|------|------|
| `useDistribution.ts` | Calls `/api/probability/compute`; returns `{ result, isLoading, error }` |
| `useNormalPDF.ts` | Calls `/api/probability/normal-pdf`; returns `{ result, isLoading, error }` |
| `useResizablePanel.ts` | Drag-to-resize panel logic |
| `useContainerBreakpoint.ts` | Viewport auto-collapse thresholds |
| `useLocalStorageState.ts` | `useState` + localStorage with schema validation |
| `useSidebarKeyboard.ts` | Keyboard shortcuts for sidebar toggle |

---

### `components/`
**Duty:** Reusable UI atoms with no business logic.

| Component | Duty |
|-----------|------|
| `DualInput.tsx` | Slider + text field pair (debounce, arrow-key stepping, clamping) |
| `DragHandle.tsx` | Drag target between resizable panels |
| `CollapsedRail.tsx` | Icon strip shown when a panel is collapsed |
| `ExportMenu.tsx` | CSV / PNG / PDF export button group |

---

### `context/`
**Duty:** Global state shared across all tabs.

| File | Duty |
|------|------|
| `DataContext.tsx` | `useReducer` store — session ID, column classifications, display precision, filters |

---

### `layout/`
**Duty:** Page skeleton — chrome that wraps every tab.

| File            | Duty                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| `LabBench.tsx`  | 3-panel layout (Controls / Observation / Notebook) with resize and collapse |
| `Header.tsx`    | Top bar + tab navigation                                                    |
| `LogoBar.tsx`   | Logo and brand mark                                                         |
| `SubHeader.tsx` | Secondary controls row below the main nav                                   |
| `Footer.tsx`    | Status bar at the bottom                                                    |

---

### `utils/`
**Duty:** Pure helper functions with no React dependency.

| File | Duty |
|------|------|
| `parseFile.ts` | CSV/TSV → JS array; column type detection |
| `exportCSV.ts` | Serialise data to `.csv` download |
| `exportPNG.ts` | Capture Plotly chart as PNG |
| `exportPDF.ts` | Capture Plotly chart as PDF |

---

### `workers/`
**Duty:** (Empty — Web Worker replaced by backend API calls.)

---

---

## Backend (`backend/`)

### `core/`
**Duty:** Pure statistical math — no HTTP, no sessions, no services.  
This folder is **identical to `ThotsakanStatistics/core/`** so the professor can verify every calculation.  
**Must NOT:** import anything from `services/`, `api/`, or `sessions/`.

| File / Folder                                | Duty                                            |
| -------------------------------------------- | ----------------------------------------------- |
| `data_stats.py`                              | Data loading and column inspection utilities    |
| `probability/common_distributions/distributions.py` | 12 distributions using scipy.stats       |
| `probability/common_distributions/normal_pdf.py`    | Normal PDF data for CI visualization      |
| `estimation/descriptive.py`                  | Mean, median, std dev, skewness, kurtosis, etc. |
| `estimation/graphical_analysis.py`           | Q-Q, P-P, empirical CDF                         |
| `estimation/inference/ci_mean.py`            | Confidence interval for the mean                |
| `estimation/inference/ci_median.py`          | Confidence interval for the median              |
| `estimation/inference/ci_deviation.py`       | Confidence interval for std deviation           |
| `estimation/inference/pi_mean.py`            | Prediction interval (mean-based)                |
| `estimation/inference/pi_median.py`          | Prediction interval (median-based)              |
| `estimation/inference/pi_iqr.py`             | Prediction interval (IQR-based)                 |
| `estimation/inference/pi_bootstrap.py`       | Bootstrap prediction interval                   |
| `estimation/inference/estimators.py`         | Point estimators                                |
| `estimation/inference/estimator_options.py`  | Estimator option enumerations                   |
| `estimation/inference/likelihood.py`         | Likelihood-based intervals                      |
| `estimation/inference/confidence_regions.py` | Joint confidence regions                        |
| `hypothesis_testing/`                        | t-test, ANOVA, chi-square, etc. (subpackage)    |
| `linear_regression/`                         | OLS, diagnostics, predictions (subpackage)      |

---

### `services/`
**Duty:** Orchestration layer — validate inputs, pick the right `core/` function(s), compose responses.  
**Must NOT:** define HTTP routes or Pydantic schemas.

| File | Duty |
|------|------|
| `descriptive.py` | Thin: validate → `core/estimation/descriptive.py` |
| `inference.py` | Thick: pick distribution, compose CI + PI + regions |
| `graphical.py` | Dispatch to `core/estimation/graphical_analysis.py` |
| `probability.py` | Thin: `core/probability/` → distribution + normal PDF responses |

---

### `api/`
**Duty:** HTTP boundary — FastAPI routes (~10 lines each) and Pydantic request/response schemas.  
**Must NOT:** contain statistical logic; delegate everything to `services/`.

| Sub-folder / File | Duty |
|-------------------|------|
| `routes/data.py` | `POST /api/data/upload`, `GET /api/data/columns` |
| `routes/descriptive.py` | `POST /api/descriptive/summary` |
| `routes/inference.py` | `POST /api/inference/ci`, `/pi`, `/regions` |
| `routes/graphical.py` | `POST /api/graphical/qq`, `/pp`, `/ecdf` |
| `routes/probability.py` | `POST /api/probability/compute`, `POST /api/probability/normal-pdf` |
| `schemas/descriptive.py` | Request + response models for descriptive routes |
| `schemas/inference.py` | Request + response models for inference routes |
| `schemas/graphical.py` | Request + response models for graphical routes |
| `schemas/probability.py` | Request + response models for probability routes |
| `deps.py` | Shared FastAPI dependencies (session lookup, etc.) |

---

### `sessions/`
**Duty:** In-memory dataset store with TTL auto-cleanup.  
Datasets are held server-side, keyed by session ID; the frontend only holds the key.

| File | Duty |
|------|------|
| `store.py` | `dict[session_id → DataFrame]` + background TTL eviction |

---

### `tests/`
**Duty:** Automated tests (pytest).

| Folder | Duty |
|--------|------|
| `tests/api/` | Integration tests hitting FastAPI routes |
| `tests/services/` | Unit tests for service-layer logic |

---

### `main.py`
**Duty:** App entry point — create FastAPI instance, configure CORS, mount all routers.

---

## Dependency Rules (summary)

```
React components
  └── hooks / api/
        └── backend via HTTP
              └── api/routes/
                    └── services/
                          └── core/   ← math lives here, nothing imports INTO core
```

- `core/` has no upstream dependencies inside the project.
- `services/` imports only from `core/`.
- `api/` imports only from `services/` and `sessions/`.
- Frontend `api/` calls backend over HTTP — never imports Python directly.

# Code Review Report

Date: 2026-04-22

Scope: backend API/services/core, frontend app/hooks/features/workers, tests, build setup, and repository hygiene.

Verification performed:
- `backend`: `pytest -q` from `backend/` fails during collection.
- `frontend`: `cmd /c npm run test` fails with 4 failing Vitest tests.
- `frontend`: `cmd /c npm run build` succeeds, but emits chunking warnings.

## Executive Summary

The repo has a solid separation between frontend, API, and math logic, and the frontend production build currently succeeds. The main risks are not style issues; they are correctness and delivery issues: the backend test suite is effectively broken, weighted analyses can mis-handle filtered/missing data, the advertised Graphical Analysis feature is wired to the wrong UI, and the frontend worker test suite is already red.

## Findings

### 1. High: backend test collection is broken, so regressions can slip through unnoticed

Evidence:
- `backend/test_descriptive.py`
- `backend/tests/api/test_descriptive.py:20`
- Running `pytest -q` from `backend/` fails with an import-file-mismatch because both modules resolve to `test_descriptive`.

Impact:
- CI or local validation cannot reliably exercise backend behavior.
- The project can appear healthy while API regressions are shipping untested.

Recommended action:
- Move root-level ad hoc scripts like `backend/test_descriptive.py`, `backend/test_local.py`, and `backend/test_pydantic.py` out of pytest discovery.
- Keep only real tests under `backend/tests/`.
- Add a `pytest.ini` or `pyproject.toml` test config so discovery paths and import mode are explicit.

### 2. High: weighted descriptive and inference flows can misalign weights after filtering or `dropna`

Evidence:
- `backend/services/descriptive.py:79`
- `backend/core/estimation/descriptive.py:56`
- `backend/core/estimation/descriptive.py:90-91`
- `backend/api/routes/inference.py:38-39`
- `backend/api/routes/inference.py:55-56`
- `backend/api/routes/inference.py:72-73`

Why this is risky:
- Descriptive stats build `series = df[req.column].dropna()` but build weights independently with `df[req.weightsCol].dropna()`.
- Core code then does `pd.Series(weights).loc[x.index]`, which can raise on missing weight rows or silently mis-handle the intended row set.
- In inference, weights are taken from the filtered dataframe without re-aligning them to `data = df[params.column].dropna()`, so estimators can receive arrays of different lengths or include weights for rows that are not in the analysis sample.

Impact:
- Weighted results can be wrong or crash for perfectly valid datasets with missing values.

Recommended action:
- Build a single filtered analysis frame first, then drop rows with missing analysis column and missing weights together when weights are requested.
- Pass aligned `data` and `weights` arrays from that same frame to descriptive and inference functions.
- Add tests covering filtered datasets, missing values in data only, missing values in weights only, and weighted inference/descriptive requests.

### 3. High: the shipped "Graphical Analysis" tab is not actually the graphical-analysis feature

Evidence:
- `frontend/src/App.tsx:61`
- `frontend/src/App.tsx:227-243`
- `frontend/src/App.tsx:304-306`
- `frontend/src/features/estimation/graphical/useGraphicalTabState.ts:5`
- `frontend/src/api/graphical.ts:18-19`

Why this is risky:
- The `graphical` sub-tab renders `NormalPDFControls`, `NormalPDFObservation`, and `NormalPDFNotebook`, which are inference-related normal-distribution components rather than the histogram/ECDF/PMF/KDE feature promised by the backend graphical API.
- There is a dedicated graphical hook and API client in the repo, but they are unused.

Impact:
- Product behavior does not match the label in the UI or the README.
- Dead code accumulates while the user-facing feature remains misleading.

Recommended action:
- Either wire the tab to a real graphical-analysis UI using `graphicalApi`/`useGraphicalTabState`, or rename the tab to match what it currently does.
- Remove or finish the unused graphical state hook.

### 4. Medium: the frontend worker test suite is red because tests and implementation disagree

Evidence:
- `frontend/src/workers/descriptiveStats.worker.ts:381`
- `frontend/src/workers/descriptiveStats.worker.ts:390`
- `frontend/src/workers/descriptiveStats.worker.test.ts:138`
- `frontend/src/workers/descriptiveStats.worker.test.ts:147`
- `frontend/src/workers/descriptiveStats.worker.test.ts:160`
- `frontend/src/workers/descriptiveStats.worker.test.ts:168`
- Running `cmd /c npm run test` fails: 4 tests expect rows named `Skewness (biased)` and `Kurtosis excess (biased)`, but the worker only emits `Skewness (k-statistic)` and `Kurtosis excess (k-statistic)`.

Impact:
- The frontend test suite cannot be trusted as a release gate.
- It is unclear whether the implementation regressed or the tests were never updated after a refactor.

Recommended action:
- Decide the intended contract.
- If both biased and unbiased statistics should exist, emit both.
- If only the k-statistic versions are intended, update the tests and any UI copy to match.

### 5. Medium: async computation errors are captured in hooks but never surfaced in the descriptive/inference UI

Evidence:
- `frontend/src/features/estimation/descriptive/useDescriptiveTabState.ts:11-35`
- `frontend/src/features/estimation/inference/useInferenceTabState.ts:33-91`
- `frontend/src/features/estimation/descriptive/DescriptiveTab.tsx:11-48`
- `frontend/src/features/estimation/inference/InferenceTab.tsx:7-37`

Why this is risky:
- Both hooks keep an `error` state and set it on backend failures.
- Neither slot interface accepts or renders that `error`.
- This means a failed API call can leave the user with no result and no explanation.

Impact:
- Poor debuggability and a confusing user experience.

Recommended action:
- Thread hook errors into the control/observation/notebook slots and show a clear inline error panel.
- Add a simple retry action for transient failures.

### 6. Medium: `LabBench` performs state writes during render

Evidence:
- `frontend/src/layout/LabBench.tsx:54`
- `frontend/src/layout/LabBench.tsx:90-94`

Why this is risky:
- `setState(...)` is called in the render path to persist panel widths.
- React can tolerate this in some cases, but it is a fragile pattern that can create unnecessary renders and makes future behavior harder to reason about.

Impact:
- Avoidable render churn and increased risk of React warnings or subtle UI bugs.

Recommended action:
- Move width persistence into `useEffect` hooks keyed on `leftPanel.width`, `rightPanel.width`, drag state, and collapse state.

### 7. Medium: frontend and backend disagree on supported upload formats

Evidence:
- `frontend/src/utils/parseFile.ts:19-20`
- `frontend/src/features/data/DataTab.tsx:41`
- `backend/api/routes/data.py:12`
- `backend/api/routes/data.py:21`

Why this is risky:
- The frontend accepts `.csv`, `.tsv`, and `.txt`.
- The backend rejects anything except `.csv` and always parses with `pd.read_csv(...)` without delimiter handling.

Impact:
- A file can preview successfully in the client and then fail when the upload is sent to the backend.

Recommended action:
- Make the contract consistent.
- Either restrict the frontend to `.csv` only, or teach the backend to accept delimiter-separated text formats intentionally and return the same type classification rules.

### 8. Medium: graphical backend endpoints are under-validated and numerically fragile for edge cases

Evidence:
- `backend/api/schemas/graphical.py:4-8`
- `backend/services/graphical.py:45`
- `backend/services/graphical.py:54`
- `backend/services/graphical.py:69-84`

Why this is risky:
- `graph_type` is a free-form string instead of an enum.
- KDE can fail for constant or tiny samples.
- Normal overlays can become invalid when sample standard deviation is zero.
- PMF/KDE behavior is not constrained by column type.

Impact:
- The API can accept invalid requests and then fail at runtime with generic 400s.

Recommended action:
- Tighten schema validation with literals/enums.
- Add explicit guardrails for constant samples, minimum sample sizes, and incompatible graph/data combinations.
- Add service tests for constant data, one-point samples, and unsupported graph types.

### 9. Medium-Low: production build succeeds, but frontend performance risk remains high because Plotly dominates the bundle

Evidence:
- `cmd /c npm run build` succeeded.
- Build output reported `plotly-vendor` at about 6.06 MB minified and emitted a chunk-size warning.
- Build also generated an empty `math-vendor` chunk.

Impact:
- Slower first-load performance and heavier client memory usage than the README performance goals imply.

Recommended action:
- Revisit `frontend/vite.config.ts` chunk strategy.
- Prefer loading only the Plotly traces actually used, or defer Plotly more aggressively behind route/component boundaries.
- Remove the empty `math-vendor` split if it is no longer carrying code.

### 10. Low: there is still legacy/unused code and documentation drift in the repo

Evidence:
- `backend/core/data_stats.py:3` still imports `gradio`.
- `backend/core/data_stats.py:6` and `:31` are legacy helpers outside the current FastAPI flow.
- `frontend/src/features/estimation/graphical/useGraphicalTabState.ts:5` appears unused.
- `README.md` documents `doc/`, but the repo currently has `docs/`.

Impact:
- Higher maintenance cost and more onboarding confusion.

Recommended action:
- Remove or quarantine legacy Gradio-era utilities.
- Clean up unused frontend feature scaffolding.
- Update README paths so contributors can trust the documentation.

## Suggested Action Plan

1. Restore the test gates first.
   Move the root-level backend scripts out of pytest discovery, configure pytest explicitly, and get `pytest` green again.

2. Fix weighted-analysis correctness next.
   Refactor descriptive and inference preprocessing so filters, `dropna`, and weights are aligned from one dataframe, then add regression tests.

3. Resolve the Graphical Analysis mismatch.
   Either ship the real graphical feature or rename/remove the misleading tab until it exists.

4. Make failures visible to users.
   Surface backend errors in descriptive and inference tabs instead of silently swallowing them in hook state.

5. Clean up frontend correctness debt.
   Reconcile the worker implementation with the failing Vitest suite and move `LabBench` persistence writes out of render.

6. Tighten contracts and cleanup.
   Unify upload format support, harden graphical schemas, prune dead code, and refresh README paths.

## Positive Notes

- The backend/frontend separation is easy to follow.
- The production frontend build currently succeeds.
- The descriptive feature has both service-level and API-level tests in place, which is a good foundation once the test harness issues are fixed.
- The codebase already has clear seams where the highest-value fixes can be made without a full rewrite.

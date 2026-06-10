<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.111+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

# ทศกัณฐ์ สถิติ — Thotsakan Statistics

> **"Stop Calculating. Start Simulating."**

An interactive **Virtual Statistics Laboratory** for Thai engineering students. Instead of memorizing formulas, students manipulate variables and observe behavior — like scientists, not test-takers.

Just as the mythical giant **Thotsakan (ทศกัณฐ์)** has 10 faces and 20 arms to command every angle of reality, this software gives students multi-dimensional tools to explore, break, and rebuild their intuition about data.

---

## ✨ Features

| Module | Description | Status |
|--------|-------------|--------|
| **Home** | Landing page with philosophy and navigation | ✅ Complete |
| **Data Lab** | CSV upload, column inspection, and filtering | 🚧 Frontend done; backend session upload not yet wired |
| **12 Distributions** | Interactive PMF / PDF / CDF for Normal, Binomial, Poisson, Exponential, and 8 more | ✅ Complete |
| **Descriptive Statistics** | Mean, median, mode, variance, skewness, kurtosis, box plots, histograms | ✅ Complete |
| **Normal PDF / CI** | Interactive normal curve with confidence-interval visualization | ✅ Complete |
| **Statistical Inference** | Confidence intervals, prediction intervals, and confidence regions | ✅ Complete |
| **Graphical Analysis** | Histogram, ECDF, KDE, PMF, and Normal overlay visualizations | 🚧 Backend done; frontend not yet wired |
| **Hypothesis Testing** | Z-test, t-test, chi-square, ANOVA — with visual rejection regions | 📋 Planned |
| **Linear Regression** | OLS, diagnostics, residual plots | 📋 Planned |

### Key Interactions

- **Slider → Authoritative Feedback**: Drag a parameter slider; after a ~250ms debounce the backend computes the result and the chart re-renders. In-flight requests are cancelled (`AbortController`) so only the latest answer lands.
- **Budget Constraints**: Real science costs money — simulations can impose sample budgets so students learn trade-offs.
- **Visual-First**: P-values and test statistics appear *after* the student sees the rejection region light up on the graph.

---

## 🏗 Architecture

**Zero Frontend Math** — the React frontend renders; the Python backend computes. There is no JS approximation layer: `core/` is the only place where statistics are calculated.

```
┌─────────────────────────────────────────────────────────────┐
│  React / TypeScript Frontend (Vite)                         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Controls   │  │ Observation  │  │    Notebook       │    │
│  │  (sliders,  │  │ (Plotly      │  │    (stats,        │    │
│  │  toggles)   │  │  charts)     │  │    explanations)  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
│         │               ▲                    ▲              │
│         ▼               │                    │              │
│  ┌──────────────────────┴────────────────────┘              │
│  │  Feature Hooks (useDistribution, useNormalPDF, ...)      │
│  │  → debounced API calls + AbortController cancellation    │
│  └──────────────────────────────────────────────────────────│
│                          │  HTTP / JSON                      │
└──────────────────────────┼──────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI / Python Backend                                    │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │ api/routes  │→│  services/   │→│  core/ (pure math)  │   │
│  │ (endpoints) │  │(orchestrate)│  │ scipy, statsmodels, │   │
│  │             │  │             │  │ pingouin            │   │
│  └────────────┘  └─────────────┘  └────────────────────┘   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ sessions/store.py — in-memory dataset store with TTL   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Why this split?**
- The **frontend** gives students the "alive" feel — debounced requests with loading skeletons keep sliders responsive without ever computing locally.
- The **backend** is the mathematical authority — the professor reads `core/` and verifies correctness directly.
- `core/` has **zero dependencies** on web frameworks — pure scipy/numpy/statsmodels.

---

## 📁 Project Structure

```
.
├── frontend/                          # React + Vite + TypeScript
│   └── src/
│       ├── api/                       # Typed fetch client for backend
│       ├── features/
│       │   ├── home/                  # Landing page
│       │   ├── data/                  # CSV upload & inspection
│       │   ├── probability/common/    # 12 distributions (PMF/PDF/CDF)
│       │   └── estimation/
│       │       ├── descriptive/       # Statistics tables & charts
│       │       ├── inference/         # CI / PI / confidence regions
│       │       └── graphical/         # Graphical analysis (in progress)
│       ├── components/                # Reusable UI atoms (DualInput, etc.)
│       ├── context/                   # Global state (DataContext)
│       ├── hooks/                     # API orchestration hooks
│       ├── layout/                    # LabBench 3-panel system
│       └── utils/                     # Export helpers, file parsing
│
├── backend/                           # FastAPI + Python
│   ├── core/                          # Pure math (professor-verified)
│   │   ├── data_stats.py
│   │   ├── probability/               # Common distributions, normal PDF
│   │   ├── estimation/
│   │   │   ├── descriptive.py
│   │   │   ├── graphical_analysis.py
│   │   │   └── inference/             # CI, PI, estimators, likelihood
│   │   ├── hypothesis_testing/        # (stub — planned)
│   │   └── linear_regression/         # (stub — planned)
│   ├── services/                      # Orchestration layer
│   ├── api/
│   │   ├── routes/                    # FastAPI endpoints
│   │   ├── schemas/                   # Pydantic request/response models
│   │   └── deps.py                    # Shared dependencies
│   ├── sessions/store.py              # In-memory session store + TTL
│   ├── tests/                         # pytest suite
│   └── main.py                        # App entry point
│
└── doc/                               # Design docs & specifications
    ├── DESIGN_PROPOSAL.md
    ├── identity.md                    # Brand philosophy & UX pillars
    ├── migration_plan.md              # Gradio → React+FastAPI roadmap
    └── ...
```

> The original Gradio app (`ThotsakanStatistics/`) and the legacy Reflex prototype (`Try_reflex/`) are kept locally as read-only references during migration, but are not tracked in this branch.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **npm** (ships with Node.js)

### 1. Clone the repository

```bash
git clone -b react-migration https://github.com/IrvingGomez/ThotsakanStatistics.git
cd ThotsakanStatistics
```

> **Note:** the React + FastAPI app lives on the `react-migration` branch. The `main` branch still holds the original Gradio application.

### 2. Install dependencies

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Run the development servers

**Option A — Run both at once** (from project root):
```bash
npm install        # install concurrently (one-time)
npm run dev        # starts frontend (5173) + backend (8000) concurrently
```

**Option B — Run separately:**

```bash
# Terminal 1: Frontend
cd frontend
npm run dev        # → http://localhost:5173

# Terminal 2: Backend
cd backend
uvicorn main:app --reload  # → http://localhost:8000
```

### 4. Verify

- Open [http://localhost:5173](http://localhost:5173) — the Thotsakan Statistics lab should load.
- Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health) should return `{"status": "ok"}`.

---

## 🧪 Running Tests

```bash
# Frontend (Vitest)
cd frontend
npm run test          # single run
npm run test:ui       # interactive Vitest UI

# Backend (pytest)
cd backend
pytest                # all tests
pytest -v             # verbose output
```

---

## 🎨 The "LabBench" UI Pattern

Every feature tab plugs into a shared 3-panel layout:

```
┌─────────────────────────────────────────────────────┐
│  Header (logo + tab navigation + subheader)         │
├──────────────┬─────────────────┬────────────────────┤
│   Controls   │   Observation   │     Notebook       │
│   (~280px)   │   (flex-grow)   │     (~320px)       │
│              │                 │                    │
│  Sliders,    │  Plotly charts, │  Stats summaries,  │
│  toggles,    │  interactive    │  explanations,     │
│  selects     │  visualizations │  KaTeX formulas    │
├──────────────┴─────────────────┴────────────────────┤
│  Footer (status bar)                                │
└─────────────────────────────────────────────────────┘
```

- Panels are **resizable** via drag handles
- Panels **auto-collapse** on narrow viewports (< 768px)
- Widths persist to `localStorage`

---

## 🔑 Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Zero frontend math** | All statistics computed in Python `core/` — one verifiable source of truth, no drift between JS and scipy |
| **Debounce + AbortController** | Sliders stay responsive: stale in-flight requests are cancelled, only the latest result renders |
| **In-memory session store** | No database needed for a teaching tool; TTL auto-cleanup keeps it simple |
| **`core/` is framework-free** | Professor reads raw Python + scipy to verify formulas |
| **Plotly (not Matplotlib)** | Hover, zoom, pan are mandatory for a lab — static images are forbidden |
| **KaTeX + MathLive** | Beautiful formula display AND interactive math input |
| **Lazy-loaded Plotly chunks** | Bundle splitting keeps initial load < 2s despite heavy charting library |

---

## ⚡ Performance Targets

| Interaction | Target |
|-------------|--------|
| Slider → debounce fires | ~250ms after last move |
| Backend authoritative result | < 500ms (typical), < 2s (bootstrap) |
| Tab switch | < 200ms (lazy loaded) |
| Initial page load | < 2s |

---

## 📚 Documentation

| Document | Contents |
|----------|----------|
| [`doc/identity.md`](doc/identity.md) | Brand philosophy, UX pillars, anti-features |
| [`doc/DESIGN_PROPOSAL.md`](doc/DESIGN_PROPOSAL.md) | Component architecture, panel slot pattern, DualInput spec |
| [`doc/migration_plan.md`](doc/migration_plan.md) | Phased roadmap from Gradio → React + FastAPI |
| [`doc/context.md`](doc/context.md) | High-level architecture layers and data flow |
| [`doc/frontend_backend_interaction.md`](doc/frontend_backend_interaction.md) | API contract and request/response patterns |

---

## 🤝 Contributing

1. **Read [`doc/identity.md`](doc/identity.md) first** — if a feature doesn't fit the "10-Armed Lab" identity, we don't build it.
2. **`core/`  is sacred** — changes to `core/` must maintain numerical correctness and remain framework-free.
3. Follow the **Controls → Observation → Notebook** naming convention for new feature tabs.
4. Write backend tests for any new `core/` or `services/` functions.

---

## 📄 License

This project is developed for educational use. Contact the maintainers for licensing details.

---

<p align="center">
  <sub>Built with 🔬 for Thai engineering students who learn by doing, not memorizing.</sub>
</p>

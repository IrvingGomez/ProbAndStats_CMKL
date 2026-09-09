import { useState, Suspense, lazy, useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import LogoBar from './layout/LogoBar'
import Header from './layout/Header'
import SubHeader, { type SubTab } from './layout/SubHeader'
import LabBench from './layout/LabBench'
import Footer from './layout/Footer'
import HomeTab from './features/home/HomeTab'
import DataTab from './features/data/DataTab'

// ── Probability: Common Distributions ────────────────────────────────────────
import CommonDistControls from './features/probability/common/CommonDistControls'
import CommonDistNotebook from './features/probability/common/CommonDistNotebook'
import {
  useDistribution,
  DISTRIBUTIONS,
  type QueryOp,
} from './hooks/useDistribution'

// Lazy-loaded heavy chart components
const CommonDistObservation = lazy(() => import('./features/probability/common/CommonDistObservation'))

// ─── Navigation config ────────────────────────────────────────────────────────

type TabId = 'home' | 'data' | 'probability' | 'estimation' | 'hypothesis' | 'regression'

// Lazy-loaded Descriptive Statistics panels (from composite DescriptiveTab)
import { useDescriptiveTabState } from './features/estimation/descriptive/useDescriptiveTabState'
const DescriptiveControlsSlot = lazy(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ControlsSlot })))
const DescriptiveObservationSlot = lazy(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.ObservationSlot })))
const DescriptiveNotebookSlot = lazy(() =>
  import('./features/estimation/descriptive/DescriptiveTab').then((m) => ({ default: m.NotebookSlot })))

// Lazy-loaded Statistical Inference panels
import { useInferenceTabState } from './features/estimation/inference/useInferenceTabState'
const InferenceControlsSlot = lazy(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ControlsSlot })))
const InferenceObservationSlot = lazy(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.ObservationSlot })))
const InferenceNotebookSlot = lazy(() =>
  import('./features/estimation/inference/InferenceTab').then((m) => ({ default: m.NotebookSlot })))

// Lazy-loaded Graphical Analysis panels
import { useGraphicalTabState } from './features/estimation/graphical/useGraphicalTabState'
const GraphicalControlsSlot = lazy(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ControlsSlot })))
const GraphicalObservationSlot = lazy(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.ObservationSlot })))
const GraphicalNotebookSlot = lazy(() =>
  import('./features/estimation/graphical/GraphicalTab').then((m) => ({ default: m.NotebookSlot })))

const SUB_TABS: Partial<Record<TabId, SubTab[]>> = {
  probability: [
    { key: 'common',  label: '📜 Common Distributions' },
    { key: 'custom',  label: '✍️ Custom Distribution' },
    { key: 'approx',  label: '🤏 Approximations' },
  ],
  estimation: [
    { key: 'descriptive', label: '🧮 Descriptive Statistics' },
    { key: 'inference',   label: '💭 Statistical Inference' },
    { key: 'graphical',   label: '📊 Graphical Analysis' },
  ],
}

const DEFAULT_SUB_TAB: Partial<Record<TabId, string>> = {
  probability: 'common',
  estimation:  'inference',
}

// ─── Placeholders ─────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
      <span className="text-3xl">🚧</span>
      <span className="text-sm text-[var(--color-text-muted)]">{label} — coming soon</span>
    </div>
  )
}

function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
      Loading chart…
    </div>
  )
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 mx-auto max-w-2xl text-center">
      <div className="border border-red-900/50 bg-red-950/20 rounded-xl p-8 w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-red-400 mb-4 flex justify-center items-center gap-2">
          <span className="text-3xl">⚠️</span> Something went wrong
        </h2>
        <div className="text-sm text-left w-full overflow-auto max-h-64 bg-black/40 border border-black/50 p-4 rounded-lg mb-6 shadow-inner">
          <pre className="font-mono text-red-200/90 leading-relaxed whitespace-pre-wrap">
            {error.name}: {error.message}
          </pre>
          {error.stack && (
            <pre className="mt-4 pt-4 border-t border-red-900/30 font-mono text-red-200/50 text-xs whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
        <button
          onClick={resetErrorBoundary}
          className="px-6 py-3 bg-[var(--color-primary)] hover:brightness-110 text-white font-medium rounded-lg shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#111] focus:ring-[var(--color-primary)]"
        >
          Recover and Restart
        </button>
      </div>
    </div>
  )
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [subTabMap, setSubTabMap] = useState<Partial<Record<TabId, string>>>(DEFAULT_SUB_TAB)

  function handleTabChange(tab: string) {
    const t = tab as TabId
    setActiveTab(t)
  }

  function handleSubTabChange(key: string) {
    setSubTabMap((prev) => ({ ...prev, [activeTab]: key }))
  }

  const activeSubTab = subTabMap[activeTab] ?? null
  const subTabs = SUB_TABS[activeTab]

  // ── Probability / Common Distributions state ───────────────────────────────
  const firstDiscrete = DISTRIBUTIONS.find((d) => d.type === 'discrete')!
  const [probModelType, setProbModelType] = useState<'discrete' | 'continuous'>('discrete')
  const [probDistName, setProbDistName] = useState(firstDiscrete.name)
  const [probParamValues, setProbParamValues] = useState<Record<string, number>>(
    Object.fromEntries(firstDiscrete.params.map((p) => [p.key, p.default]))
  )
  const [probQueryOp, setProbQueryOp] = useState<QueryOp>('<=')
  const [probQueryK, setProbQueryK] = useState(5)

  const probDistParams = useMemo(() => ({
    distName: probDistName,
    paramValues: probParamValues,
    queryOp: probQueryOp,
    queryK: probQueryK,
  }), [probDistName, probParamValues, probQueryOp, probQueryK])

  const { result: probResult, isLoading: probLoading } = useDistribution(probDistParams)

  function handleDistChange(name: string) {
    const dist = DISTRIBUTIONS.find((d) => d.name === name)!
    setProbDistName(name)
    setProbParamValues(Object.fromEntries(dist.params.map((p) => [p.key, p.default])))
  }

  function handleModelTypeChange(t: 'discrete' | 'continuous') {
    setProbModelType(t)
    const first = DISTRIBUTIONS.find((d) => d.type === t)!
    handleDistChange(first.name)
  }

  // ── Descriptive Statistics state ─────────────────────────────────────────
  const descriptive = useDescriptiveTabState()

  // ── Statistical Inference state ──────────────────────────────────────────
  const inference = useInferenceTabState()

  // ── Graphical Analysis state ─────────────────────────────────────────────
  const graphical = useGraphicalTabState()

  // ── Slot content resolver ──────────────────────────────────────────────────
  let controls: React.ReactNode
  let observation: React.ReactNode
  let notebook: React.ReactNode
  let footerDataset: string | undefined

  // ── Probability tab ────────────────────────────────────────────────────────
  if (activeTab === 'probability') {
    if (activeSubTab === 'common') {
      footerDataset = `${probDistName} Distribution`
      controls = (
        <CommonDistControls
          modelType={probModelType}
          distName={probDistName}
          paramValues={probParamValues}
          queryOp={probQueryOp}
          queryK={probQueryK}
          queryResult={probResult?.queryResult ?? null}
          onModelTypeChange={handleModelTypeChange}
          onDistChange={handleDistChange}
          onParamChange={(key, val) => {
            setProbParamValues((prev) => ({ ...prev, [key]: val }))
          }}
          onQueryOpChange={setProbQueryOp}
          onQueryKChange={setProbQueryK}
        />
      )
      observation = (
        <Suspense fallback={<ChartFallback />}>
          <CommonDistObservation
            distParams={probDistParams}
            result={probResult}
            isLoading={probLoading}
          />
        </Suspense>
      )
      notebook = (
        <CommonDistNotebook
          distParams={probDistParams}
          result={probResult}
          isLoading={probLoading}
        />
      )
    } else {
      controls    = <ComingSoon label="Custom Distribution" />
      observation = <ComingSoon label="Custom Distribution" />
      notebook    = <ComingSoon label="Custom Distribution" />
    }

  // ── Estimation tab ─────────────────────────────────────────────────────────
  } else if (activeTab === 'estimation') {
    if (activeSubTab === 'graphical') {
      footerDataset = 'Graphical Analysis'
      controls = (
        <Suspense fallback={<ChartFallback />}>
          <GraphicalControlsSlot
            onLive={graphical.applyLive}
            onRun={graphical.run}
            onReset={graphical.reset}
            isComputing={graphical.isComputing}
            isDirty={graphical.isDirty}
          />
        </Suspense>
      )
      observation = (
        <Suspense fallback={<ChartFallback />}>
          <GraphicalObservationSlot
            result={graphical.result}
            column={graphical.column}
            graphType={graphical.graphType}
            hasData={graphical.hasData}
            isComputing={graphical.isComputing}
            staleOverlays={graphical.staleOverlays}
            error={graphical.error}
          />
        </Suspense>
      )
      notebook = (
        <Suspense fallback={<ChartFallback />}>
          <GraphicalNotebookSlot
            result={graphical.result}
            column={graphical.column}
            graphType={graphical.graphType}
            precision={graphical.precision}
            staleOverlays={graphical.staleOverlays}
          />
        </Suspense>
      )
    } else if (activeSubTab === 'inference') {
      footerDataset = 'Statistical Inference'
      controls = (
        <Suspense fallback={<ChartFallback />}>
          <InferenceControlsSlot onRun={inference.handleRun} onReset={inference.handleReset} isComputing={inference.isComputing} />
        </Suspense>
      )
      observation = (
        <Suspense fallback={<ChartFallback />}>
          <InferenceObservationSlot
            ciResult={inference.ciResult}
            piResult={inference.piResult}
            regionResult={inference.regionResult}
            hasData={inference.hasData}
            precision={inference.precision}
            isComputing={inference.isComputing}
          />
        </Suspense>
      )
      notebook = (
        <Suspense fallback={<ChartFallback />}>
          <InferenceNotebookSlot
            ciResult={inference.ciResult}
            piResult={inference.piResult}
            regionResult={inference.regionResult}
            precision={inference.precision}
          />
        </Suspense>
      )
    } else if (activeSubTab === 'descriptive') {
      footerDataset = 'Descriptive Statistics'
      controls = (
        <Suspense fallback={<ChartFallback />}>
          <DescriptiveControlsSlot onRun={descriptive.handleRun} onReset={descriptive.handleReset} isComputing={descriptive.isComputing} />
        </Suspense>
      )
      observation = (
        <Suspense fallback={<ChartFallback />}>
          <DescriptiveObservationSlot
            result={descriptive.result}
            config={descriptive.config}
            hasData={descriptive.hasData}
            precision={descriptive.precision}
            isComputing={descriptive.isComputing}
          />
        </Suspense>
      )
      notebook = (
        <Suspense fallback={<ChartFallback />}>
          <DescriptiveNotebookSlot
            result={descriptive.result}
            config={descriptive.config}
            filename={descriptive.filename}
            filteredN={descriptive.filteredN}
            rawN={descriptive.rawN}
            precision={descriptive.precision}
          />
        </Suspense>
      )
    }

  // ── Other tabs ─────────────────────────────────────────────────────────────
  } else if (activeTab !== 'home') {
    const label = activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
    controls    = <ComingSoon label={label} />
    observation = <ComingSoon label={label} />
    notebook    = <ComingSoon label={label} />
  }

  // ── Home/Data tabs use full-width layout instead of LabBench ──────────────
  const isHome = activeTab === 'home'
  const isFullWidth = isHome || activeTab === 'data'

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] text-[var(--color-text)]">
      <LogoBar />
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      {!isFullWidth && (
        <SubHeader
          subTabs={subTabs}
          activeSubTab={activeSubTab ?? undefined}
          onSubTabChange={handleSubTabChange}
        />
      )}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => <ErrorFallback error={error as Error} resetErrorBoundary={resetErrorBoundary} />} onReset={() => setActiveTab('home')}>
          {isHome
            ? <HomeTab onNavigate={handleTabChange} />
            : activeTab === 'data'
              ? <DataTab />
              : <LabBench controls={controls} observation={observation} notebook={notebook} />
          }
        </ErrorBoundary>
      </div>
      <Footer dataset={footerDataset} version="0.1.0-alpha" />
    </div>
  )
}

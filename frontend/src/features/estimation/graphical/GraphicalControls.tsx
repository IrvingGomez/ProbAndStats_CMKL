// features/estimation/graphical/GraphicalControls.tsx
// Left panel: variable, graph type, display toggles (live) and the overlay
// cascade (estimators / bootstrap) which only computes on Run.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useData } from '../../../context/DataContext'
import { inferenceApi } from '../../../api/inference'
import DualInput from '../../../components/DualInput'
import type { CIChoice, GraphType, MuSource, PIChoice } from '../../../api/graphical'
import {
  BOUNDS,
  DEFAULT_CONFIG,
  clearWeightsIfUnused,
  configForDataset,
  supportedOverlays,
  type GraphicalConfig,
} from './graphicalState'

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
      {children}
    </p>
  )
}

function Divider() {
  return <div className="border-t border-[var(--color-border)] my-3" />
}

function SelectField({
  label, value, onChange, options, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md px-2.5 py-1.5 text-xs bg-[var(--color-bg-input)]
          border border-[var(--color-border-md)] text-[var(--color-text)]
          focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function TextInput({
  label, value, onChange, placeholder, hint, error,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; error?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className={`text-xs ${error ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md px-2.5 py-1.5 text-xs font-mono bg-[var(--color-bg-input)]
          border ${error ? 'border-red-500/50' : 'border-[var(--color-border-md)]'} text-[var(--color-text)]
          placeholder-[var(--color-text-muted)] focus:outline-none
          ${error ? 'focus:border-red-500' : 'focus:border-[var(--color-accent)]'}`}
      />
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function Toggle({
  label, value, onChange, hint,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => onChange(!value)}>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={label}
          className={`relative w-8 h-4 rounded-full shrink-0 transition-colors ${value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-md)]'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : ''}`} />
        </button>
        <span className="text-xs text-[var(--color-text)]">{label}</span>
      </div>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)] ml-10 -mt-0.5 mb-1">{hint}</p>}
    </div>
  )
}

function RadioRow<T extends string>({
  label, value, onChange, options,
}: {
  label: string; value: T; onChange: (v: T) => void; options: readonly T[]
}) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer
              ${o === value
                ? 'border-[var(--color-accent)] text-[var(--color-text)] bg-[var(--color-accent)]/15'
                : 'border-[var(--color-border-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Indented block revealed by the checkbox above it. */
function Nested({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-3 pl-3 mb-2 border-l border-[var(--color-border-md)]">
      {children}
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAPH_TYPES: { value: GraphType; label: string }[] = [
  { value: 'Histogram', label: 'Histogram' },
  { value: 'PMF', label: 'Empirical PMF' },
  { value: 'ECDF', label: 'ECDF' },
]

const CI_CHOICES = ['Both', 'Mean', 'Median'] as const satisfies readonly CIChoice[]
const PI_CHOICES = ['Mean', 'Median', 'IQR', 'Bootstrap'] as const satisfies readonly PIChoice[]
const MU_SOURCES = ['Mean-based CI', 'Median-based CI'] as const satisfies readonly MuSource[]

const FALLBACK_MEAN_ESTIMATORS = ['Sample Mean']
const FALLBACK_DEVIATION_ESTIMATORS = ['Deviation (1 ddof)']
const MEDIAN_ESTIMATORS = ['Sample Median']

// ─── Props ────────────────────────────────────────────────────────────────────

interface GraphicalControlsProps {
  onLive: (cfg: GraphicalConfig) => void
  onRun: (cfg: GraphicalConfig) => void
  onReset: () => void
  isComputing: boolean
  isDirty: boolean
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GraphicalControls({
  onLive, onRun, onReset, isComputing, isDirty,
}: GraphicalControlsProps) {
  const { state } = useData()
  const hasData = state.status === 'ready' && state.numericCols.length > 0

  const [cfg, setCfg] = useState<GraphicalConfig>({
    column: state.numericCols[0] ?? '',
    ...DEFAULT_CONFIG,
  })

  // Text fields keep their own string state so a half-typed value is not parsed
  // into the config. Numeric parameters use DualInput, which clamps instead.
  const [winsorRaw, setWinsorRaw] = useState('0.1, 0.1')
  const [autoBins, setAutoBins] = useState(true)

  const [meanEstimators, setMeanEstimators] = useState<string[]>(FALLBACK_MEAN_ESTIMATORS)
  const [deviationEstimators, setDeviationEstimators] = useState<string[]>(FALLBACK_DEVIATION_ESTIMATORS)
  const [error, setError] = useState<string | null>(null)

  const set = useCallback(<K extends keyof GraphicalConfig>(key: K, value: GraphicalConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }))
  }, [])

  const shows = useMemo(() => supportedOverlays(cfg.graphType), [cfg.graphType])
  const isEcdf = cfg.graphType === 'ECDF'
  const wantsEstimators = isEcdf
    ? cfg.addNormal
    : (cfg.addNormal || cfg.addCi || cfg.addPi)
  const anyBoot = cfg.bootstrapMean || cfg.bootstrapMedian || cfg.bootstrapPi

  // A new upload (or a column list that no longer contains the selection) must
  // not leave the previous dataset's column selected.
  useEffect(() => {
    setCfg((prev) => configForDataset(prev, state.numericCols))
  }, [state.numericCols, state.sessionId])

  // Estimator choices depend on the data (no geometric/harmonic mean when any
  // value is ≤ 0) — reuse the inference endpoint rather than hardcoding lists.
  useEffect(() => {
    if (!state.sessionId || !cfg.column) return
    let active = true
    inferenceApi
      .getEstimators({ session_id: state.sessionId, column: cfg.column })
      .then((opts) => {
        if (!active) return
        setMeanEstimators(opts.mean_estimators)
        setDeviationEstimators(opts.deviation_estimators)
        setCfg((prev) => ({
          ...prev,
          meanEstimator: opts.mean_estimators.includes(prev.meanEstimator)
            ? prev.meanEstimator : opts.mean_estimators[0],
          sigmaEstimator: opts.deviation_estimators.includes(prev.sigmaEstimator)
            ? prev.sigmaEstimator : opts.deviation_estimators[0],
        }))
      })
      .catch(() => { /* falls back to the safe defaults */ })
    return () => { active = false }
  }, [state.sessionId, cfg.column])

  // Live path — display-only settings.
  useEffect(() => {
    if (!hasData || !cfg.column) return
    onLive(cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasData, cfg.column, cfg.graphType, cfg.bins, cfg.addKde,
    cfg.addData, cfg.addConfBand, cfg.ecdfConfLevel,
  ])

  const handleRun = useCallback(() => {
    setError(null)

    let winsorLimits: string | null = null
    if (cfg.meanEstimator === 'Winsorized Mean') {
      const parts = winsorRaw.split(',').map((s) => parseFloat(s.trim()))
      if (parts.length !== 2 || parts.some((p) => isNaN(p) || p < 0 || p >= 0.5)) {
        setError('Winsorized limits must be two values in [0, 0.5), e.g. "0.1, 0.1".')
        return
      }
      winsorLimits = winsorRaw
    }

    if (cfg.meanEstimator === 'Trimmed Mean' && cfg.trimParam === null) {
      setError('Set a trim fraction α for the trimmed mean.')
      return
    }

    if (cfg.meanEstimator === 'Weighted Mean' && !cfg.weightsColumn) {
      setError('Select a weights column for the weighted mean.')
      return
    }

    if (cfg.addPi && cfg.piChoice === 'Bootstrap' && !cfg.bootstrapPi) {
      setError('Tick "Bootstrap prediction" to use the bootstrap prediction interval.')
      return
    }

    // A weights column left over from the weighted mean would otherwise reach
    // the backend and shrink the sample for every statistic on the plot.
    const next = clearWeightsIfUnused({ ...cfg, winsorLimits })
    setCfg(next)
    onRun(next)
  }, [cfg, winsorRaw, onRun])

  const handleReset = useCallback(() => {
    setCfg(configForDataset({ column: state.numericCols[0] ?? '', ...DEFAULT_CONFIG }, state.numericCols))
    setWinsorRaw('0.1, 0.1')
    setAutoBins(true)
    setError(null)
    onReset()
  }, [state.numericCols, onReset])

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 pt-10 pb-6 text-center">
        <span className="text-3xl">📂</span>
        <p className="text-sm text-[var(--color-text-muted)]">
          No dataset loaded. Go to the <strong className="text-[var(--color-text)]">Data</strong> tab to upload a CSV file.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">

      {/* Variable */}
      <SectionLabel>Variable</SectionLabel>
      <SelectField
        label="Numeric column"
        value={cfg.column}
        onChange={(v) => set('column', v)}
        options={state.numericCols}
        placeholder="— select column —"
      />

      <Divider />

      {/* Graph type */}
      <SectionLabel>Graph</SectionLabel>
      <div className="flex flex-col gap-1 mb-3">
        {GRAPH_TYPES.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => set('graphType', g.value)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
              ${g.value === cfg.graphType
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text)]'
                : 'border-[var(--color-border-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {shows.bins && (
        <>
          <Toggle
            label="Automatic bin count"
            value={autoBins}
            onChange={(v) => { setAutoBins(v); set('bins', v ? null : 20) }}
          />
          {!autoBins && (
            <Nested>
              <DualInput
                label="Bins"
                value={cfg.bins ?? 20}
                min={BOUNDS.bins.min}
                max={BOUNDS.bins.max}
                step={BOUNDS.bins.step}
                decimals={0}
                onChange={(v) => set('bins', v)}
              />
            </Nested>
          )}
        </>
      )}

      <Divider />

      {/* Display / overlays */}
      <SectionLabel>Overlays</SectionLabel>

      {shows.kde && (
        <Toggle label="KDE" value={cfg.addKde} onChange={(v) => set('addKde', v)} />
      )}
      {shows.rug && (
        <Toggle label="Show data (rug)" value={cfg.addData} onChange={(v) => set('addData', v)} />
      )}

      {shows.confBand && (
        <>
          <Toggle
            label="Confidence band for the ECDF"
            value={cfg.addConfBand}
            onChange={(v) => set('addConfBand', v)}
            hint="Dvoretzky–Kiefer–Wolfowitz band"
          />
          {cfg.addConfBand && (
            <Nested>
              <DualInput
                label="Confidence level"
                value={cfg.ecdfConfLevel}
                min={BOUNDS.confLevel.min}
                max={BOUNDS.confLevel.max}
                step={BOUNDS.confLevel.step}
                decimals={3}
                onChange={(v) => set('ecdfConfLevel', v)}
              />
            </Nested>
          )}
        </>
      )}

      {shows.normal ? (
        <>
          <Toggle
            label={isEcdf ? 'Normal CDF' : 'Normal density'}
            value={cfg.addNormal}
            onChange={(v) => set('addNormal', v)}
          />
          {cfg.addNormal && (
            <Nested>
              <RadioRow label="μ based on" value={cfg.normalMuSource} onChange={(v) => set('normalMuSource', v)} options={MU_SOURCES} />
            </Nested>
          )}
        </>
      ) : (
        <p className="text-[10px] text-[var(--color-text-muted)] leading-snug mb-2">
          Density overlays are unavailable here: an empirical PMF plots probability,
          not density, so a KDE or normal curve would not be on the same scale.
        </p>
      )}

      {shows.intervals && (
        <>
          <Toggle label="Confidence interval" value={cfg.addCi} onChange={(v) => set('addCi', v)} />
          {cfg.addCi && (
            <Nested>
              <RadioRow label="CI for" value={cfg.ciChoice} onChange={(v) => set('ciChoice', v)} options={CI_CHOICES} />
            </Nested>
          )}

          <Toggle label="Prediction interval" value={cfg.addPi} onChange={(v) => set('addPi', v)} />
          {cfg.addPi && (
            <Nested>
              <RadioRow label="PI from" value={cfg.piChoice} onChange={(v) => set('piChoice', v)} options={PI_CHOICES} />
            </Nested>
          )}
        </>
      )}

      {/* Estimators — revealed only when an overlay needs them */}
      {wantsEstimators && (
        <>
          <Divider />
          <SectionLabel>Estimators</SectionLabel>
          <SelectField
            label="Mean estimator"
            value={cfg.meanEstimator}
            onChange={(v) => setCfg((prev) => clearWeightsIfUnused({ ...prev, meanEstimator: v }))}
            options={meanEstimators}
          />
          {cfg.meanEstimator === 'Trimmed Mean' && (
            <Nested>
              <DualInput
                label="Trimmed mean α"
                value={cfg.trimParam ?? 0.1}
                min={BOUNDS.trim.min}
                max={BOUNDS.trim.max}
                step={BOUNDS.trim.step}
                decimals={2}
                onChange={(v) => set('trimParam', v)}
              />
            </Nested>
          )}
          {cfg.meanEstimator === 'Winsorized Mean' && (
            <Nested>
              <TextInput label="Winsorized limits" value={winsorRaw} onChange={setWinsorRaw} placeholder="0.1, 0.1" hint="Two values in [0, 0.5)" />
            </Nested>
          )}
          {cfg.meanEstimator === 'Weighted Mean' && (
            <Nested>
              <SelectField
                label="Weights column"
                value={cfg.weightsColumn ?? ''}
                onChange={(v) => set('weightsColumn', v || null)}
                options={state.numericCols.filter((c) => c !== cfg.column)}
                placeholder="— select column —"
              />
            </Nested>
          )}
          <SelectField
            label="Median estimator"
            value={cfg.medianEstimator}
            onChange={(v) => set('medianEstimator', v)}
            options={MEDIAN_ESTIMATORS}
          />
          <SelectField
            label="Deviation estimator"
            value={cfg.sigmaEstimator}
            onChange={(v) => set('sigmaEstimator', v)}
            options={deviationEstimators}
          />

          {(cfg.addCi || cfg.addPi) && (
            <DualInput
              label="Confidence level (CI / PI)"
              value={cfg.confLevel}
              min={BOUNDS.confLevel.min}
              max={BOUNDS.confLevel.max}
              step={BOUNDS.confLevel.step}
              decimals={3}
              onChange={(v) => set('confLevel', v)}
            />
          )}

          <SectionLabel>Bootstrap</SectionLabel>
          <Toggle label="Bootstrap mean" value={cfg.bootstrapMean} onChange={(v) => set('bootstrapMean', v)} />
          <Toggle label="Bootstrap median" value={cfg.bootstrapMedian} onChange={(v) => set('bootstrapMedian', v)} />
          {cfg.addPi && (
            <Toggle label="Bootstrap prediction" value={cfg.bootstrapPi} onChange={(v) => set('bootstrapPi', v)} />
          )}
          {anyBoot && (
            <Nested>
              <DualInput
                label="Bootstrap samples"
                value={cfg.bootstrapSamples}
                min={BOUNDS.bootstrapSamples.min}
                max={BOUNDS.bootstrapSamples.max}
                step={BOUNDS.bootstrapSamples.step}
                decimals={0}
                onChange={(v) => set('bootstrapSamples', v)}
              />
            </Nested>
          )}
        </>
      )}

      <Divider />

      {error && <p className="text-xs text-red-400 mb-3 leading-snug">{error}</p>}

      {isDirty && (
        <p className="text-[11px] text-amber-500 mb-2 leading-snug">
          ● Overlay settings changed — press Run to apply them.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={isComputing}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer
            disabled:opacity-50 text-white
            ${isDirty ? 'bg-amber-600 hover:brightness-110' : 'bg-[var(--color-accent)] hover:brightness-110'}`}
        >
          {isComputing ? 'Computing…' : isDirty ? '🚀 Run (pending)' : '🚀 Run'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-md)]
            text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          🔄 Reset
        </button>
      </div>
      {wantsEstimators && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-snug">
          Display toggles update the plot as you change them. Estimator-backed
          overlays wait for Run.
        </p>
      )}
    </div>
  )
}

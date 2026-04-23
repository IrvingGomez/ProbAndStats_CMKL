// features/estimation/descriptive/DescriptiveControls.tsx
// Left panel: variable selection, statistical parameters, display options, run/reset

import { useState, useCallback, useEffect } from 'react'
import { useData } from '../../../context/DataContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DescriptiveConfig {
  column: string
  weightsCol: string | null
  quantileProbs: number[]
  trimAlpha: number | null
  winsorLimits: [number, number] | null
  showConsistencyCorr: boolean
  advancedStats: string[]
}

export const DEFAULT_CONFIG: Omit<DescriptiveConfig, 'column'> = {
  weightsCol: null,
  quantileProbs: [0.25, 0.5, 0.75],
  trimAlpha: null,
  winsorLimits: null,
  showConsistencyCorr: true,
  advancedStats: [],
}

interface DescriptiveControlsProps {
  onRun: (cfg: DescriptiveConfig) => void
  onReset: () => void
  isComputing?: boolean
}

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
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; error?: boolean
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
          border ${error ? 'border-red-500/50' : 'border-[var(--color-border-md)]'} text-[var(--color-text)] placeholder-[var(--color-text-muted)]
          focus:outline-none ${error ? 'focus:border-red-500' : 'focus:border-[var(--color-accent)]'}`}
      />
      {hint && <p className="text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer mb-2" onClick={() => onChange(!value)}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-md)]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-xs text-[var(--color-text)]">{label}</span>
    </div>
  )
}

function Accordion({ title, children, isOpen, onToggle }: { title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="mb-3 border border-[var(--color-border-md)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2 text-xs font-semibold bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text)] flex justify-between items-center"
      >
        {title}
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isOpen && (
        <div className="p-3 bg-[var(--color-bg)] text-xs border-t border-[var(--color-border-md)]">
          {children}
        </div>
      )}
    </div>
  )
}

const ADVANCED_STATS_GROUPS = [
  {
    group: 'Central Tendency',
    items: [
      { id: 'iqm',             label: 'Interquartile Mean (IQM)' },
      { id: 'trimmed_mean',    label: 'Trimmed Mean' },
      { id: 'winsorized_mean', label: 'Winsorized Mean' },
      { id: 'geometric_mean',  label: 'Geometric Mean' },
      { id: 'harmonic_mean',   label: 'Harmonic Mean' },
      { id: 'weighted_mean',   label: 'Weighted Mean' },
    ],
  },
  {
    group: 'Dispersion',
    items: [
      { id: 'variance_0', label: 'Variance (ddof=0)' },
      { id: 'variance_1', label: 'Variance (ddof=1)' },
      { id: 'std_dev_0',  label: 'Std Dev (ddof=0)' },
      { id: 'iqr',        label: 'IQR' },
      { id: 'range',      label: 'Range' },
      { id: 'mad',        label: 'MAD (Median Abs Dev)' },
      { id: 'aad',        label: 'AAD (Mean Abs Dev)' },
    ],
  },
  {
    group: 'Shape',
    items: [
      { id: 'skewness', label: 'Skewness' },
      { id: 'kurtosis', label: 'Kurtosis' },
    ],
  },
] as const

const ALL_ADVANCED_IDS = ADVANCED_STATS_GROUPS.flatMap(g => g.items.map(i => i.id))

function GroupedMultiSelect({
  selected, onChange, trimRaw, setTrimRaw, winsorRaw, setWinsorRaw, trimError, winsorError,
}: {
  selected: string[]
  onChange: (v: string[]) => void
  trimRaw: string
  setTrimRaw: (v: string) => void
  winsorRaw: string
  setWinsorRaw: (v: string) => void
  trimError?: boolean
  winsorError?: boolean
}) {
  const allSelected = ALL_ADVANCED_IDS.every(id => selected.includes(id))

  return (
    <div className="flex flex-col gap-2">
      {/* Select All / Clear */}
      <div className="flex gap-2 text-[10px] text-[var(--color-accent)] font-medium">
        <button type="button" onClick={() => onChange(ALL_ADVANCED_IDS.slice())} disabled={allSelected}
          className="hover:underline cursor-pointer disabled:opacity-40">
          Select All
        </button>
        <span className="text-[var(--color-border-md)]">·</span>
        <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}
          className="hover:underline cursor-pointer disabled:opacity-40">
          Clear
        </button>
      </div>

      {/* Grouped items */}
      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
        {ADVANCED_STATS_GROUPS.map(({ group, items }) => {
          const groupIds = items.map(i => i.id)
          const allInGroup = groupIds.every(id => selected.includes(id))
          const someInGroup = groupIds.some(id => selected.includes(id))
          return (
            <div key={group}>
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  type="checkbox"
                  checked={allInGroup}
                  ref={el => { if (el) el.indeterminate = someInGroup && !allInGroup }}
                  onChange={() => {
                    if (allInGroup) onChange(selected.filter(id => !groupIds.includes(id as never)))
                    else onChange([...selected, ...groupIds.filter(id => !selected.includes(id))])
                  }}
                  className="accent-[var(--color-accent)] cursor-pointer w-3 h-3"
                />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{group}</span>
              </div>
              <div className="flex flex-col gap-1 ml-4">
                {items.map((item) => {
                  const checked = selected.includes(item.id)
                  return (
                    <div key={item.id} className="flex flex-col">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => checked ? onChange(selected.filter(id => id !== item.id)) : onChange([...selected, item.id])}
                          className="accent-[var(--color-accent)] cursor-pointer w-3.5 h-3.5 shrink-0"
                        />
                        {item.label}
                      </label>
                      {checked && item.id === 'trimmed_mean' && (
                        <div className="ml-5 mt-1 mb-1">
                          <input type="text" value={trimRaw} onChange={e => setTrimRaw(e.target.value)}
                            placeholder="α (e.g. 0.1)"
                            className={`w-full rounded bg-[var(--color-bg-input)] border ${trimError ? 'border-red-500/50' : 'border-[var(--color-border-md)]'} px-2 py-1 text-[11px] font-mono focus:${trimError ? 'border-red-500' : 'border-[var(--color-accent)]'} focus:outline-none placeholder-[var(--color-text-muted)] text-[var(--color-text)]`}
                          />
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Fraction to trim from each tail</p>
                        </div>
                      )}
                      {checked && item.id === 'winsorized_mean' && (
                        <div className="ml-5 mt-1 mb-1">
                          <input type="text" value={winsorRaw} onChange={e => setWinsorRaw(e.target.value)}
                            placeholder="lo, hi (e.g. 0.1, 0.1)"
                            className={`w-full rounded bg-[var(--color-bg-input)] border ${winsorError ? 'border-red-500/50' : 'border-[var(--color-border-md)]'} px-2 py-1 text-[11px] font-mono focus:${winsorError ? 'border-red-500' : 'border-[var(--color-accent)]'} focus:outline-none placeholder-[var(--color-text-muted)] text-[var(--color-text)]`}
                          />
                          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Comma-separated pair in (0, 0.5)</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

function parseQuantiles(raw: string): number[] | null {
  try {
    const vals = raw.split(',').map((s) => parseFloat(s.trim())).filter((v) => !isNaN(v) && v >= 0 && v <= 1)
    return vals.length > 0 ? vals : null
  } catch { return null }
}

function parsePair(raw: string): [number, number] | null {
  const parts = raw.split(',').map((s) => parseFloat(s.trim()))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DescriptiveControls({ onRun, onReset }: DescriptiveControlsProps) {
  const { state } = useData()

  // Local state
  const [column, setColumn] = useState<string>(state.numericCols[0] ?? '')
  const [weightsCol, setWeightsCol] = useState<string>('')
  const [quantilesRaw, setQuantilesRaw] = useState('0.25, 0.5, 0.75')
  const [trimRaw, setTrimRaw] = useState('')
  const [winsorRaw, setWinsorRaw] = useState('')
  const [showConsistencyCorr, setShowConsistencyCorr] = useState(true)
  const [advancedStats, setAdvancedStats] = useState<string[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ quantiles?: boolean; trim?: boolean; winsor?: boolean }>({})

  const hasData = state.status === 'ready' && state.numericCols.length > 0

  const handleRun = useCallback(() => {
    setError(null)
    setFieldErrors({})

    if (!column) { setError('Please select a numeric variable.'); return }

    const quantileProbs = parseQuantiles(quantilesRaw)
    if (!quantileProbs || quantileProbs.length === 0 || quantileProbs.some(p => p <= 0 || p >= 1)) {
      setError('Invalid quantiles. Use comma-separated values between 0 and 1 (exclusive), e.g. "0.25, 0.5, 0.75".')
      setFieldErrors(prev => ({ ...prev, quantiles: true }))
      return
    }

    const trimAlpha = trimRaw.trim() === ''
      ? null
      : (() => {
          const v = parseFloat(trimRaw)
          if (isNaN(v) || v < 0 || v >= 0.5) return undefined
          return v
        })()

    if (trimRaw.trim() !== '' && trimAlpha === undefined) {
      setError('Invalid trim alpha. Value must be between 0 (inclusive) and 0.5 (exclusive).')
      setFieldErrors(prev => ({ ...prev, trim: true }))
      return
    }

    const winsorLimits = winsorRaw.trim() === '' ? null : parsePair(winsorRaw)
    if (winsorRaw.trim() !== '' && (!winsorLimits || winsorLimits.some(l => l < 0 || l >= 0.5))) {
      setError('Invalid winsorize limits. Use two comma-separated values between 0 and 0.5 (exclusive), e.g. "0.1, 0.1".')
      setFieldErrors(prev => ({ ...prev, winsor: true }))
      return
    }

    onRun({
      column,
      weightsCol: weightsCol || null,
      quantileProbs,
      trimAlpha: trimAlpha ?? null,
      winsorLimits,
      showConsistencyCorr,
      advancedStats,
    })
  }, [column, weightsCol, quantilesRaw, trimRaw, winsorRaw, showConsistencyCorr, advancedStats, onRun])

  // React to changes in configuration and auto-run
  useEffect(() => {
    if (hasData) {
      handleRun()
    }
  }, [handleRun, hasData])

  const handleReset = useCallback(() => {
    setColumn(state.numericCols[0] ?? '')
    setWeightsCol('')
    setQuantilesRaw('0.25, 0.5, 0.75')
    setTrimRaw('')
    setWinsorRaw('')
    setShowConsistencyCorr(true)
    setAdvancedStats([])
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

      {/* Variable Selection */}
      <SectionLabel>Variable Selection</SectionLabel>
      <SelectField
        label="Numeric Variable"
        value={column}
        onChange={(v) => { setColumn(v); setError(null) }}
        options={state.numericCols}
        placeholder="— select column —"
      />
      <SelectField
        label="Weights Column (optional)"
        value={weightsCol}
        onChange={setWeightsCol}
        options={['', ...state.numericCols.filter((c) => c !== column)]}
        placeholder="— None —"
      />

      <Divider />

      {/* Statistical Parameters */}
      <SectionLabel>Statistical Parameters</SectionLabel>
      <TextInput
        label="Quantile probabilities"
        value={quantilesRaw}
        onChange={setQuantilesRaw}
        placeholder="0.25, 0.5, 0.75"
        hint="Comma-separated, values in [0, 1]"
        error={fieldErrors.quantiles}
      />
      <Accordion title="Advanced Statistics" isOpen={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)}>
        <GroupedMultiSelect
          selected={advancedStats}
          onChange={setAdvancedStats}
          trimRaw={trimRaw}
          setTrimRaw={setTrimRaw}
          winsorRaw={winsorRaw}
          setWinsorRaw={setWinsorRaw}
          trimError={fieldErrors.trim}
          winsorError={fieldErrors.winsor}
        />
      </Accordion>

      <Divider />

      <SectionLabel>Display Options</SectionLabel>
      <Toggle label="Show consistency corrected" value={showConsistencyCorr} onChange={setShowConsistencyCorr} />

      <Divider />

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 mb-3 leading-snug">{error}</p>
      )}

      {/* Action buttons */}
      <button
        type="button"
        onClick={handleReset}
        className="w-full mt-2 py-1.5 rounded-lg border border-[var(--color-border-md)]
          text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text)] transition-colors cursor-pointer"
      >
        🔄 Reset to Defaults
      </button>
    </div>
  )
}

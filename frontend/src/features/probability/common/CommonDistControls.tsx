import { useMemo, useState, useEffect } from 'react'
import DualInput from '../../../components/DualInput'
import { DISTRIBUTIONS, type QueryOp } from '../../../hooks/useDistribution'

interface CommonDistControlsProps {
  modelType: 'discrete' | 'continuous'
  distName: string
  paramValues: Record<string, number>
  queryOp: QueryOp
  queryK: number
  queryResult: number | null
  onModelTypeChange: (t: 'discrete' | 'continuous') => void
  onDistChange: (name: string) => void
  onParamChange: (key: string, value: number) => void
  onQueryOpChange: (op: QueryOp) => void
  onQueryKChange: (k: number) => void
}

const QUERY_OPS: QueryOp[] = ['<=', '>=', '=', '<', '>']

export default function CommonDistControls({
  modelType,
  distName,
  paramValues,
  queryOp,
  queryK,
  queryResult,
  onModelTypeChange,
  onDistChange,
  onParamChange,
  onQueryOpChange,
  onQueryKChange,
}: CommonDistControlsProps) {
  const availableDists = useMemo(
    () => DISTRIBUTIONS.filter((d) => d.type === modelType),
    [modelType]
  )

  const currentDist = DISTRIBUTIONS.find((d) => d.name === distName)

  const [queryKText, setQueryKText] = useState(String(queryK))

  useEffect(() => {
    setQueryKText(String(queryK))
  }, [queryK])

  const handleQueryKChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setQueryKText(raw)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && raw !== '-' && raw !== '') {
      onQueryKChange(parsed)
    }
  }

  const handleQueryKBlur = () => {
    if (queryKText === '-' || queryKText === '' || isNaN(parseFloat(queryKText))) {
      setQueryKText(String(queryK))
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Model Type toggle */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-2">
          Model Type
        </p>
        <div className="flex rounded-md overflow-hidden border border-[var(--color-border-md)]">
          {(['discrete', 'continuous'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onModelTypeChange(t)}
              className={`flex-1 py-1.5 text-sm capitalize transition-colors cursor-pointer
                ${modelType === t
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution dropdown */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-2">
          Distribution
        </label>
        <select
          value={distName}
          onChange={(e) => onDistChange(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm
            bg-[var(--color-bg-input)] border border-[var(--color-border-md)]
            text-[var(--color-text)] cursor-pointer
            focus:outline-none focus:border-[var(--color-accent)]"
        >
          {availableDists.map((d) => (
            <option key={d.name} value={d.name}>{d.name} Distribution</option>
          ))}
        </select>
      </div>

      <div className="h-px bg-[var(--color-border)]" />

      {/* Distribution parameters */}
      {currentDist && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest
            text-[var(--color-text-muted)] mb-3">
            Distribution Parameters
          </p>
          <div className="flex flex-col gap-4">
            {currentDist.params.map((param) => (
              <DualInput
                key={param.key}
                label={param.label}
                value={paramValues[param.key] ?? param.default}
                min={param.min}
                max={param.max}
                step={param.step}
                decimals={param.decimals}
                onChange={(v) => onParamChange(param.key, param.integer ? Math.round(v) : v)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-[var(--color-border)]" />

      {/* Probability Query */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-3">
          Probability Query
        </p>
        <div className="flex gap-2 mb-3">
          {/* Op select */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">Op</span>
            <select
              value={queryOp}
              onChange={(e) => onQueryOpChange(e.target.value as QueryOp)}
              className="rounded-md px-2 py-1.5 text-sm w-16
                bg-[var(--color-bg-input)] border border-[var(--color-border-md)]
                text-[var(--color-text)] cursor-pointer
                focus:outline-none focus:border-[var(--color-accent)]"
            >
              {QUERY_OPS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          {/* Value input */}
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-[var(--color-text-muted)]">Value (k)</span>
            <input
              type="number"
              value={queryKText}
              step={modelType === 'discrete' ? 1 : 0.1}
              onChange={handleQueryKChange}
              onBlur={handleQueryKBlur}
              className="rounded-md px-3 py-1.5 text-sm w-full
                bg-[var(--color-bg-input)] border border-[var(--color-border-md)]
                text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
        {/* Live query result */}
        <div className="mt-2 rounded-md px-3 py-2 border border-[var(--color-accent)]/30
          bg-[var(--color-accent)]/5 text-center">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5">
            P(X {queryOp} {modelType === 'discrete' ? Math.round(queryK) : queryK})
          </p>
          <p className="text-lg font-bold font-mono tabular-nums text-[var(--color-accent)]">
            {queryResult != null ? queryResult.toFixed(4) : '—'}
          </p>
        </div>
      </div>

    </div>
  )
}

// features/estimation/descriptive/DescriptiveObservation.tsx
// Center panel: stat cards + grouped table + histogram/box-plot

import { useState, useRef, useEffect, useMemo } from 'react'
import Plot from 'react-plotly.js'
import { type DescriptiveResult, type StatRow } from '../../../api/descriptive'
import type { DescriptiveConfig } from './DescriptiveControls'

// ─── Warning Snackbar ─────────────────────────────────────────────────────────

interface SnackItem { id: number; measure: string; warning: string }

function WarningSnackbar({ warnings }: { warnings: SnackItem[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  // Build a stable fingerprint so effects only fire when warnings actually change
  const fingerprint = warnings.map(w => w.measure).join('|')

  // Reset dismissed state when warnings list actually changes
  const prevFingerprint = useRef(fingerprint)
  useEffect(() => {
    if (prevFingerprint.current !== fingerprint) {
      prevFingerprint.current = fingerprint
      setDismissed(new Set())
    }
  }, [fingerprint])

  // Auto-dismiss each item after 6 s
  useEffect(() => {
    if (warnings.length === 0) return
    const timers = warnings.map(w =>
      setTimeout(() => setDismissed(prev => new Set(prev).add(w.id)), 6000)
    )
    return () => timers.forEach(clearTimeout)
  }, [fingerprint]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = warnings.filter(w => !dismissed.has(w.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-2" role="alert" aria-live="polite">
      {visible.map(w => (
        <div
          key={w.id}
          className="flex items-start gap-3 px-3 py-2.5 rounded-lg
            bg-amber-950/60 border border-amber-500/40 text-amber-300
            shadow-lg animate-fade-in"
        >
          <span className="text-base leading-none mt-0.5 shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-200 truncate">{w.measure}</p>
            <p className="text-[11px] text-amber-400 leading-snug mt-0.5">{w.warning}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(prev => new Set(prev).add(w.id))}
            className="shrink-0 text-amber-500 hover:text-amber-200 transition-colors text-sm leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'Extremes': { bg: 'bg-rose-950/50', text: 'text-rose-300', label: 'text-rose-400' },
  'Quantiles': { bg: 'bg-violet-950/50', text: 'text-violet-300', label: 'text-violet-400' },
  'Central Tendency': { bg: 'bg-blue-950/50', text: 'text-blue-300', label: 'text-blue-400' },
  'Dispersion': { bg: 'bg-emerald-950/50', text: 'text-emerald-300', label: 'text-emerald-400' },
  'Shape': { bg: 'bg-amber-950/50', text: 'text-amber-300', label: 'text-amber-400' },
}

// ─── Statistics Table ─────────────────────────────────────────────────────────

function StatsTable({
  rows, showConsistencyCorr, precision,
}: {
  rows: StatRow[]; showConsistencyCorr: boolean; precision: number
}) {
  const [copied, setCopied] = useState(false)

  // Group by category maintaining order
  const groups: { cat: string; rows: StatRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last?.cat === row.category) last.rows.push(row)
    else groups.push({ cat: row.category, rows: [row] })
  }

  function fmt(v: number | null) {
    if (v === null || isNaN(v)) return '—'
    return v.toFixed(precision)
  }

  function exportCSV() {
    const header = showConsistencyCorr
      ? 'Category,Measure,Value,Consistency Corrected\n'
      : 'Category,Measure,Value\n'
    const body = rows.map((r) =>
      showConsistencyCorr
        ? `"${r.category}","${r.measure}",${fmt(r.value)},${fmt(r.consistencyCorr)}`
        : `"${r.category}","${r.measure}",${fmt(r.value)}`
    ).join('\n')

    const blob = new Blob([header + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'descriptive_stats.csv'
    a.click()
    URL.revokeObjectURL(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl shadow-sm bg-[var(--color-bg-panel)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--color-border)]/30 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-muted)]">
          Descriptive Statistics
        </span>
        <button
          type="button"
          onClick={exportCSV}
          className="text-[10px] text-[var(--color-accent)] hover:underline cursor-pointer"
        >
          {copied ? '✓ Saved!' : '⬇ Export CSV'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]/50">
              <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-normal w-36">Category</th>
              <th className="px-3 py-2 text-left text-[var(--color-text-muted)] font-normal">Measure</th>
              <th className="px-3 py-2 text-right text-[var(--color-text-muted)] font-normal w-28">Value</th>
              {showConsistencyCorr && (
                <th className="px-3 py-2 text-right text-[var(--color-text-muted)] font-normal w-28">Consist. Corr.</th>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ cat, rows: gRows }) => {
              const style = CATEGORY_STYLE[cat] ?? { bg: '', text: 'text-[var(--color-text)]', label: 'text-[var(--color-text-muted)]' }
              return gRows.map((row, i) => (
                <tr
                  key={`${cat}-${row.measure}`}
                  className={`border-b border-[var(--color-border)]/30 last:border-0 ${style.bg}`}
                >
                  <td className={`px-3 py-1.5 font-medium ${style.label}`}>
                    {i === 0 ? cat : ''}
                  </td>
                  <td className={`px-3 py-1.5 ${style.text}`}>
                    <div className="flex items-center gap-2">
                      <span>{row.measure}</span>
                      {row.robust && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30" title="Robust statistic">
                          Robust
                        </span>
                      )}
                      {row.warning && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-help"
                          title={row.warning}
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${style.text}`}>
                    {fmt(row.value)}
                  </td>
                  {showConsistencyCorr && (
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                      {fmt(row.consistencyCorr)}
                    </td>
                  )}
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const PLOT_BG     = 'rgba(0,0,0,0)'
const GRID_COLOR  = '#1f2937'
const LABEL_COLOR = '#d1d5db'   // gray-300  — tick numbers  (~5.7:1 on gray-900)
const TITLE_COLOR = '#e5e7eb'   // gray-200  — axis titles   (~7:1   on gray-900)
const ACCENT      = '#6366f1'
const BOX_COLOR   = '#818cf8'

function DescriptiveCharts({ result, colName }: { result: DescriptiveResult; colName: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [plotWidth, setPlotWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setPlotWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { histogram, boxData } = result

  // Build histogram bin centers and width
  const histX = histogram.binEdges.slice(0, -1).map(
    (lo, i) => (lo + histogram.binEdges[i + 1]) / 2
  )
  const histWidth = histogram.binEdges.length > 1
    ? histogram.binEdges[1] - histogram.binEdges[0]
    : 1

  // ── Helpers ───────────────────────────────────────────────────────────────
  // 4 sig-figs, no trailing zeros
  const fmt = (v: number) => parseFloat(v.toPrecision(4)).toString()

  // Invisible scatter marker on the box strip — one per stat, gives clean
  // individual hover labels. opacity:0 = invisible, size:14 = generous hit area.
  const statPoint = (label: string, x: number) => ({
    type: 'scatter' as const,
    mode: 'markers' as const,
    x: [x], y: [0],
    xaxis: 'x', yaxis: 'y2',
    marker: { opacity: 0, size: 14, color: BOX_COLOR },
    hovertemplate: `${label}: ${fmt(x)}<extra></extra>`,
    showlegend: false,
  })

  // ── Traces ──────────────────────────────────────────────────────────────
  const traces = [
    // Histogram (bottom subplot)
    {
      type: 'bar' as const,
      x: histX,
      y: histogram.counts,
      width: histWidth,
      marker: { color: ACCENT, opacity: 0.85 },
      // Pass bin edges so the hover template can show the range instead of the center
      customdata: histogram.binEdges.slice(0, -1).map((lo, i) => [
        parseFloat(lo.toPrecision(4)),
        parseFloat(histogram.binEdges[i + 1].toPrecision(4)),
      ]),
      hovertemplate: '%{customdata[0]} – %{customdata[1]}<br>Count: %{y}<extra></extra>',
      showlegend: false,
    },
    // Horizontal box plot (top subplot, shared x-axis)
    {
      type: 'box' as const,
      orientation: 'h' as const,
      q1: [boxData.q1],
      median: [boxData.median],
      q3: [boxData.q3],
      lowerfence: [boxData.whiskerLo],
      upperfence: [boxData.whiskerHi],
      mean: [result.summary.mean],
      xaxis: 'x',
      yaxis: 'y2',
      marker: { color: BOX_COLOR, size: 4 },
      line: { color: BOX_COLOR },
      fillcolor: `${BOX_COLOR}22`,
      name: colName,
      // Annotations already cover Q1/Mdn/Q3/Mean — disable box hover entirely
      // to prevent the 45° rotated multi-label pile-up
      hoverinfo: 'skip' as const,
      showlegend: false,
    },
    // ── Invisible stat-point overlays for individual hover labels ────────────
    // One scatter marker per key stat on the box strip. opacity:0 = invisible,
    // size:14 = generous hit area. hovermode:'closest' ensures only one fires.
    statPoint('Lower fence', boxData.whiskerLo),
    statPoint('Q1',          boxData.q1),
    statPoint('Median',      boxData.median),
    statPoint('Mean',        result.summary.mean),
    statPoint('Q3',          boxData.q3),
    statPoint('Upper fence', boxData.whiskerHi),
    // Outliers — one scatter trace covering all outlier values
    ...(boxData.outliers.length > 0 ? [{
      type: 'scatter' as const,
      mode: 'markers' as const,
      x: boxData.outliers,
      y: boxData.outliers.map(() => 0),
      xaxis: 'x', yaxis: 'y2',
      marker: { opacity: 0.85, size: 10, color: '#f87171' },
      hovertemplate: 'Outlier: %{x:.4~g}<extra></extra>',
      showlegend: false,
    }] : []),
  ]

  // ── Layout ──────────────────────────────────────────────────────────────
  const layout = {
    paper_bgcolor: PLOT_BG,
    plot_bgcolor: PLOT_BG,
    font: { color: LABEL_COLOR, size: 11 },
    margin: { t: 12, b: 48, l: 52, r: 12 },
    width: plotWidth,
    height: 400,
    showlegend: false,
    dragmode: 'pan' as const,
    hovermode: 'closest' as const,
    hoverlabel: {
      bgcolor: '#1e293b',       // slate-800 — dark, slightly lighter than the panel
      bordercolor: '#475569',   // slate-600 — visible but subtle border
      font: { color: '#e5e7eb', size: 11 },
      align: 'left' as const,
    },
    xaxis: {
      gridcolor: GRID_COLOR,
      zerolinecolor: GRID_COLOR,
      title: { text: colName, font: { color: TITLE_COLOR, size: 11 } },
      tickformat: '.4~g',
      nticks: 6,
      automargin: true,
    },
    yaxis: {
      gridcolor: GRID_COLOR,
      zerolinecolor: GRID_COLOR,
      title: { text: 'Frequency', font: { color: TITLE_COLOR, size: 11 } },
      domain: [0, 0.73],
      tickformat: 'd',
      automargin: true,
    },
    yaxis2: {
      domain: [0.78, 1.0],
      showticklabels: false,
      showgrid: false,
      zeroline: false,
    },
    annotations: [
      // Strip identity label — top-left of the box plot area
      {
        text: 'Box Plot (Tukey)',
        xref: 'paper' as const, x: 0.01,
        yref: 'paper' as const, y: 0.99,
        xanchor: 'left' as const, yanchor: 'top' as const,
        showarrow: false,
        font: { color: TITLE_COLOR, size: 10 },
      },
      // Q1
      {
        text: `Q1: ${fmt(boxData.q1)}`,
        xref: 'x' as const, x: boxData.q1,
        yref: 'paper' as const, y: 0.82,
        xanchor: 'center' as const, yanchor: 'bottom' as const,
        showarrow: false,
        font: { color: LABEL_COLOR, size: 9 },
      },
      // Median — brightest, most important
      {
        text: `Mdn: ${fmt(boxData.median)}`,
        xref: 'x' as const, x: boxData.median,
        yref: 'paper' as const, y: 0.82,
        xanchor: 'center' as const, yanchor: 'bottom' as const,
        showarrow: false,
        font: { color: TITLE_COLOR, size: 9 },
      },
      // Q3
      {
        text: `Q3: ${fmt(boxData.q3)}`,
        xref: 'x' as const, x: boxData.q3,
        yref: 'paper' as const, y: 0.82,
        xanchor: 'center' as const, yanchor: 'bottom' as const,
        showarrow: false,
        font: { color: LABEL_COLOR, size: 9 },
      },
      // Mean line label — top of histogram, left of line
      {
        text: `Mean: ${fmt(result.summary.mean)}`,
        xref: 'x' as const, x: result.summary.mean,
        yref: 'paper' as const, y: 0.72,
        xanchor: 'center' as const, yanchor: 'top' as const,
        showarrow: false,
        font: { color: ACCENT, size: 9 },
        bgcolor: 'rgba(11,16,32,0.8)',
        borderpad: 2,
      },
      // Median line label — staggered lower to prevent overlap with mean label
      {
        text: `Mdn: ${fmt(boxData.median)}`,
        xref: 'x' as const, x: boxData.median,
        yref: 'paper' as const, y: 0.64,
        xanchor: 'center' as const, yanchor: 'top' as const,
        showarrow: false,
        font: { color: '#a5b4fc', size: 9 },
        bgcolor: 'rgba(11,16,32,0.8)',
        borderpad: 2,
      },
    ],
    shapes: [
      // Mean reference line — spans histogram area only
      {
        type: 'line' as const,
        xref: 'x' as const, x0: result.summary.mean, x1: result.summary.mean,
        yref: 'paper' as const, y0: 0, y1: 0.73,
        line: { color: ACCENT, width: 1.5, dash: 'dash' },
      },
      // Median reference line — dotted, lighter indigo
      {
        type: 'line' as const,
        xref: 'x' as const, x0: boxData.median, x1: boxData.median,
        yref: 'paper' as const, y0: 0, y1: 0.73,
        line: { color: '#a5b4fc', width: 1.5, dash: 'dot' },
      },
    ],
  }

  const config = { displayModeBar: false, responsive: true }

  return (
    <div ref={wrapperRef} className="rounded-xl shadow-sm bg-[var(--color-bg-panel)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--color-border)]/30">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-muted)]">
          Distribution
        </span>
      </div>
      <div className="p-2">
        <Plot
          data={traces}
          layout={layout}
          config={config}
          useResizeHandler
        />
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasData }: { hasData: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-50">
      <span className="text-5xl">{hasData ? '🚀' : '📂'}</span>
      <p className="text-sm text-[var(--color-text-muted)] text-center max-w-xs">
        {hasData
          ? 'Select variables to see results.'
          : 'Load a dataset from the Data tab to explore descriptive statistics.'}
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DescriptiveObservationProps {
  result: DescriptiveResult | null
  config: DescriptiveConfig | null
  hasData: boolean
  precision: number
}

export default function DescriptiveObservation({
  result, config, hasData, precision,
}: DescriptiveObservationProps) {
  if (!result || !config) return <EmptyState hasData={hasData} />

  // Collect warnings from visible rows
  const visibleRows = result.rows.filter(r => !r.advancedId || config.advancedStats.includes(r.advancedId))
  const warnings: SnackItem[] = useMemo(() => {
    const w = visibleRows
      .filter(r => r.warning)
      .map((r, i) => ({ id: i, measure: r.measure, warning: r.warning! }))
    // DEBUG: remove after confirming snackbar works
    console.log('[DescriptiveObs] advancedStats:', config.advancedStats,
      '| rows with warnings:', result.rows.filter(r => r.warning).map(r => r.measure),
      '| visible warnings:', w.map(x => x.measure))
    return w
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, config.advancedStats])

  return (
    <div className="flex flex-col gap-5">

      {/* Warning snackbar */}
      <WarningSnackbar warnings={warnings} />

      {/* Statistics Table */}
      <StatsTable
        rows={result.rows.filter(r => !r.advancedId || config.advancedStats.includes(r.advancedId))}
        showConsistencyCorr={config.showConsistencyCorr}
        precision={precision}
      />

      {/* Charts */}
      <DescriptiveCharts result={result} colName={config.column} />

    </div>
  )
}

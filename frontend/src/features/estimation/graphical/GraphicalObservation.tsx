// features/estimation/graphical/GraphicalObservation.tsx
// Centre panel: the plot itself. Histogram / empirical PMF / ECDF with the
// requested overlays, plus an interval strip below when CI/PI bands are on.

import { useCallback, useMemo } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import type { GraphicalResponse } from '../../../api/graphical'
import ExportMenu from '../../../components/ExportMenu'
import { downloadChartPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'

const Plot = createPlotlyComponent(Plotly)

const CHART_DIV_ID = 'graphical-analysis-chart'

// Plotly parses colors itself — CSS vars don't resolve, so use literals.
const C_MAIN = '#a78bfa'      // rebeccapurple, lifted for dark backgrounds
const C_KDE = '#c4b5fd'
const C_BAND = 'rgba(167, 139, 250, 0.25)'
const C_RUG = '#94a3b8'
const C_NORMAL = '#e5e7eb'
const C_CI_MEAN = '#3b82f6'
const C_CI_MEDIAN = '#10b981'
const C_PI = '#f43f5e'

const AXIS = { color: '#9ca3af', gridcolor: 'rgba(128,128,128,0.15)', zeroline: false }
const CONFIG = { responsive: true, displayModeBar: false }

// Interval strip rows, matching the matplotlib overlay's geometry.
const BAND_Y: Record<string, number> = { ci_mean: 0.4, ci_median: 0.3, pi: 0.1 }
const BAND_COLOR: Record<string, string> = {
  ci_mean: C_CI_MEAN,
  ci_median: C_CI_MEDIAN,
  pi: C_PI,
}

interface GraphicalObservationProps {
  result: GraphicalResponse | null
  column: string
  graphType: string
  hasData: boolean
  isComputing: boolean
  /** Overlays the last Run produced that this result no longer carries. */
  staleOverlays: string[]
  error: string | null
}

/** Bar centres and widths from histogram edges. */
function barsFromEdges(bins: number[], densities: number[]) {
  const x: number[] = []
  const width: number[] = []
  for (let i = 0; i < densities.length; i++) {
    x.push((bins[i] + bins[i + 1]) / 2)
    width.push(bins[i + 1] - bins[i])
  }
  return { x, width }
}

export default function GraphicalObservation({
  result, column, graphType, hasData, isComputing, staleOverlays, error,
}: GraphicalObservationProps) {
  const bands = result?.interval_bands ?? []
  const hasStrip = bands.length > 0

  const traces = useMemo(() => {
    if (!result) return []
    const out: Record<string, unknown>[] = []

    if (result.histogram_data) {
      const { bins, densities } = result.histogram_data
      const { x, width } = barsFromEdges(bins, densities)
      out.push({
        type: 'bar', x, y: densities, width,
        marker: { color: C_MAIN, opacity: 0.5, line: { color: C_MAIN, width: 1 } },
        name: 'Density',
        hovertemplate: '%{x:.4g}<br>density %{y:.4g}<extra></extra>',
      })
    }

    if (result.pmf_data) {
      const { values, probs } = result.pmf_data
      // Stem plot: one line segment per value, then the marker heads.
      const stemX: (number | null)[] = []
      const stemY: (number | null)[] = []
      values.forEach((v, i) => { stemX.push(v, v, null); stemY.push(0, probs[i], null) })
      out.push({
        type: 'scatter', mode: 'lines', x: stemX, y: stemY,
        line: { color: C_MAIN, width: 1.5 }, hoverinfo: 'skip', showlegend: false,
      })
      out.push({
        type: 'scatter', mode: 'markers', x: values, y: probs,
        marker: { color: C_MAIN, size: 7 }, name: 'Probability',
        hovertemplate: '%{x:.4g}<br>P = %{y:.4g}<extra></extra>',
      })
    }

    if (result.ecdf_data) {
      const { x, y, lower, upper } = result.ecdf_data
      if (lower && upper) {
        out.push({
          type: 'scatter', mode: 'lines', x, y: lower, line: { shape: 'hv', width: 0 },
          hoverinfo: 'skip', showlegend: false,
        })
        out.push({
          type: 'scatter', mode: 'lines', x, y: upper, line: { shape: 'hv', width: 0 },
          fill: 'tonexty', fillcolor: C_BAND, name: 'DKW band', hoverinfo: 'skip',
        })
      }
      out.push({
        type: 'scatter', mode: 'lines+markers', x, y,
        line: { shape: 'hv', color: C_MAIN, width: 2 },
        marker: { color: C_MAIN, size: 4 }, name: 'ECDF',
        hovertemplate: '%{x:.4g}<br>F(x) = %{y:.4g}<extra></extra>',
      })
    }

    if (result.kde_curve) {
      out.push({
        type: 'scatter', mode: 'lines',
        x: result.kde_curve.x, y: result.kde_curve.y,
        line: { color: C_KDE, width: 2 }, name: 'KDE', hoverinfo: 'skip',
      })
    }

    if (result.rug_data) {
      out.push({
        type: 'scatter', mode: 'markers',
        x: result.rug_data.x, y: result.rug_data.x.map(() => 0),
        marker: { color: C_RUG, size: 10, symbol: 'line-ns-open', line: { width: 1 } },
        name: 'Observations',
        hovertemplate: '%{x:.4g}<extra></extra>',
      })
    }

    if (result.normal_curve) {
      out.push({
        type: 'scatter', mode: 'lines',
        x: result.normal_curve.x, y: result.normal_curve.y,
        line: { color: C_NORMAL, width: 2, dash: 'dash' },
        name: graphType === 'ECDF' ? 'Normal CDF' : 'Normal density',
        hovertemplate: '%{x:.4g}<br>%{y:.4g}<extra></extra>',
      })
    }

    // Interval strip (second row).
    bands.forEach((b) => {
      const y = BAND_Y[b.kind] ?? 0.25
      const color = BAND_COLOR[b.kind] ?? C_PI
      out.push({
        type: 'scatter', mode: 'lines', yaxis: 'y2',
        x: [b.low, b.high], y: [y, y],
        line: { color, width: 3 }, name: b.label,
        hovertemplate: `${b.label}<br>[%{x:.4g}]<extra></extra>`,
      })
      out.push({
        type: 'scatter', mode: 'markers', yaxis: 'y2',
        x: [b.center], y: [y],
        marker: { color, size: 8 }, showlegend: false, hoverinfo: 'skip',
      })
    })

    return out
  }, [result, bands, graphType])

  const layout = useMemo(() => {
    const yTitle =
      graphType === 'ECDF' ? 'ECDF' : graphType === 'PMF' ? 'Probability' : 'Density'
    const title =
      graphType === 'ECDF' ? 'Empirical Cumulative Distribution Function'
        : graphType === 'PMF' ? `Empirical PMF of ${column}`
          : `Distribution of ${column}`

    return {
      autosize: true,
      title: { text: title, font: { color: '#9ca3af', size: 13 } },
      margin: { l: 56, r: 20, t: 44, b: 44 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#9ca3af', size: 11 },
      bargap: 0.02,
      xaxis: { ...AXIS, title: column, anchor: hasStrip ? 'y2' : 'y' },
      yaxis: {
        ...AXIS,
        title: yTitle,
        domain: hasStrip ? [0.34, 1] : [0, 1],
        ...(graphType === 'ECDF' ? { range: [0, 1.05] } : {}),
      },
      ...(hasStrip
        ? {
          yaxis2: {
            ...AXIS,
            domain: [0, 0.24],
            range: [0, 0.5],
            showticklabels: false,
            showgrid: false,
          },
        }
        : {}),
      showlegend: true,
      legend: { font: { color: '#9ca3af', size: 10 }, bgcolor: 'transparent', orientation: 'h', y: -0.18 },
    }
  }, [column, graphType, hasStrip])

  // ── Exports ───────────────────────────────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    downloadChartPNG(CHART_DIV_ID, `graphical-${column}-${graphType}.png`)
  }, [column, graphType])

  const handleExportCSV = useCallback(() => {
    if (!result) return
    const rows: (string | number)[][] = []
    if (result.histogram_data) {
      rows.push(['bin_low', 'bin_high', 'count', 'density'])
      const { bins, counts, densities } = result.histogram_data
      counts.forEach((c, i) => rows.push([bins[i], bins[i + 1], c, densities[i]]))
    } else if (result.pmf_data) {
      rows.push(['value', 'probability'])
      result.pmf_data.values.forEach((v, i) => rows.push([v, result.pmf_data!.probs[i]]))
    } else if (result.ecdf_data) {
      const { x, y, lower, upper } = result.ecdf_data
      rows.push(lower && upper ? ['x', 'ecdf', 'lower', 'upper'] : ['x', 'ecdf'])
      x.forEach((v, i) => rows.push(
        lower && upper ? [v, y[i], lower[i], upper[i]] : [v, y[i]]
      ))
    }
    downloadCSV(rows, `graphical-${column}-${graphType}.csv`)
  }, [result, column, graphType])

  const handleExportPDF = useCallback(async () => {
    const { downloadPDF } = await import('../../../utils/exportPDF')
    const stats = [
      { label: 'n', value: String(result?.summary.n ?? '—') },
      { label: 'Unique values', value: String(result?.summary.n_unique ?? '—') },
    ]
    if (result?.point_estimates?.mu != null) {
      stats.push({ label: 'μ̂', value: result.point_estimates.mu.toPrecision(6) })
    }
    if (result?.point_estimates?.sigma != null) {
      stats.push({ label: 'σ̂', value: result.point_estimates.sigma.toPrecision(6) })
    }
    await downloadPDF({
      divId: CHART_DIV_ID,
      title: `Graphical Analysis — ${column}`,
      subtitle: graphType,
      stats,
      filename: `graphical-${column}-${graphType}.pdf`,
    })
  }, [result, column, graphType])

  // ── States ────────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]
        border border-dashed border-[var(--color-border-md)] rounded-xl m-4">
        Waiting for data — upload a CSV on the Data tab.
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-lg w-full border border-red-900/50 bg-red-950/20 rounded-xl p-5">
          <p className="text-sm font-semibold text-red-400 mb-2">⚠️ Could not draw this plot</p>
          <pre className="text-xs font-mono text-red-200/90 whitespace-pre-wrap leading-relaxed">{error}</pre>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        {isComputing ? 'Computing…' : 'Select a column to draw the plot.'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {staleOverlays.length > 0 && (
        <div className="mx-2 mt-2 px-3 py-2 rounded-md border border-amber-700/50 bg-amber-950/20
          text-[11px] text-amber-400 leading-snug">
          Not shown on this plot: {staleOverlays.join(', ')}. A resample cannot be
          repeated from a display change — press Run to draw it again.
        </div>
      )}
      <div className="flex justify-end px-2 pt-2">
        <ExportMenu
          onExportPNG={handleExportPNG}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          ready={!!result}
        />
      </div>
      <div className="flex-1 min-h-0">
        <Plot
          divId={CHART_DIV_ID}
          data={traces}
          layout={layout}
          config={CONFIG}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

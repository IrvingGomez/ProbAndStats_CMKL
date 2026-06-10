import { useMemo, useCallback } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import type { DistResult, DistParams, QueryOp } from '../../../hooks/useDistribution'
import { DISTRIBUTIONS } from '../../../hooks/useDistribution'
import ExportMenu from '../../../components/ExportMenu'
import { downloadChartPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'

const Plot = createPlotlyComponent(Plotly)

const CHART_DIV_ID = 'common-dist-chart'

interface CommonDistObservationProps {
  distParams: DistParams
  result: DistResult | null
  isLoading: boolean
}

const LAYOUT_BASE = {
  autosize: true,
  margin: { l: 52, r: 20, t: 50, b: 60 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#9ca3af', size: 11 },
  xaxis: { color: '#9ca3af', gridcolor: '#1f2937', zerolinecolor: '#334155' },
  yaxis: { color: '#9ca3af', gridcolor: '#1f2937', zerolinecolor: '#334155' },
  showlegend: true,
  legend: { font: { color: '#9ca3af', size: 10 }, bgcolor: 'transparent', orientation: 'h' as const, y: -0.18 },
  bargap: 0.15,
}

function opLabel(op: QueryOp, k: number, result: number): string {
  return `P(X ${op} ${k}) = ${result.toFixed(3)}`
}

export default function CommonDistObservation({ distParams, result }: CommonDistObservationProps) {
  const { distName, queryOp, queryK, paramValues } = distParams
  const dist = DISTRIBUTIONS.find((d) => d.name === distName)

  // ── Export handlers ──────────────────────────────────────────────────────
  const slug = distName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const handleExportPNG = useCallback(() => {
    downloadChartPNG(CHART_DIV_ID, `${slug}-chart.png`)
  }, [slug])

  const handleExportCSV = useCallback(() => {
    if (!result) return
    if (dist?.type === 'discrete') {
      const { ks = [], probs = [], cumProbs = [] } = result
      const rows: (string | number)[][] = [['k', 'P(X=k)', 'P(X<=k)']]
      ks.forEach((k: number, i: number) => rows.push([k, probs[i] ?? 0, cumProbs[i] ?? 0]))
      downloadCSV(rows, `${slug}-pmf.csv`)
    } else {
      const { xs = [], ys = [], cdfYs = [] } = result
      const rows: (string | number)[][] = [['x', 'f(x)', 'F(x)']]
      xs.forEach((x: number, i: number) => rows.push([x, ys[i] ?? 0, cdfYs[i] ?? 0]))
      downloadCSV(rows, `${slug}-pdf.csv`)
    }
  }, [dist, result, slug])

  const handleExportPDF = useCallback(async () => {
    if (!result) return
    const meanStr = typeof result.theorMean === 'number' ? result.theorMean.toFixed(4) : String(result.theorMean)
    const varStr  = typeof result.theorVariance === 'number' ? result.theorVariance.toFixed(4) : String(result.theorVariance)
    const { downloadPDF } = await import('../../../utils/exportPDF')
    downloadPDF({
      divId: CHART_DIV_ID,
      title: `${distName} Distribution`,
      subtitle: `Query: P(X ${queryOp} ${queryK}) = ${result.queryResult.toFixed(4)}`,
      stats: [
        { label: 'Distribution', value: distName },
        { label: 'Type',         value: dist?.type === 'discrete' ? 'Discrete' : 'Continuous' },
        { label: 'Mean E[X]',    value: meanStr },
        { label: 'Variance',     value: varStr },
        { label: `P(X ${queryOp} ${queryK})`, value: result.queryResult.toFixed(4) },
        ...Object.entries(paramValues).map(([k, v]) => ({ label: k, value: String(v) })),
      ],
      filename: `${slug}-report.pdf`,
    })
  }, [distName, dist, queryOp, queryK, result, paramValues, slug])

  const statCards = useMemo(() => {
    if (!result) return []
    return [
      {
        label: 'Theoretical Mean',
        value: typeof result.theorMean === 'number' ? result.theorMean.toFixed(3) : String(result.theorMean),
      },
      {
        label: 'Variance',
        value: typeof result.theorVariance === 'number' ? result.theorVariance.toFixed(3) : String(result.theorVariance),
      },
      {
        label: opLabel(queryOp, queryK, result.queryResult),
        value: result.queryResult.toFixed(3),
        highlight: true,
      },
    ]
  }, [result, queryOp, queryK])

  const { traces, layout } = useMemo(() => {
    if (!dist || !result) return { traces: [], layout: LAYOUT_BASE }

    const kVal = Math.round(queryK)

    if (dist.type === 'discrete') {
      const { ks = [], probs = [] } = result

      // Color bars: highlight bars that satisfy the query condition
      const colors = ks.map((k) => {
        let match = false
        switch (queryOp) {
          case '<=': match = k <= kVal; break
          case '>=': match = k >= kVal; break
          case '=':  match = k === kVal; break
          case '<':  match = k < kVal; break
          case '>':  match = k > kVal; break
        }
        return match ? '#6366f1' : '#334155'
      })

      return {
        traces: [
          {
            x: ks,
            y: probs,
            type: 'bar' as const,
            marker: { color: colors },
            name: 'P(X = k)',
            hovertemplate: 'k=%{x}<br>P(X=k)=%{y:.4f}<extra></extra>',
          },
        ],
        layout: {
          ...LAYOUT_BASE,
          title: {
            text: `${distName} — ${opLabel(queryOp, kVal, result.queryResult)}`,
            font: { color: '#e5e7eb', size: 13 },
          },
          xaxis: { ...LAYOUT_BASE.xaxis, title: 'X (number of occurrences)' },
          yaxis: { ...LAYOUT_BASE.yaxis, title: 'P(X = k)' },
        },
      }
    } else {
      const { xs = [], ys = [] } = result

      // Shade area satisfying query condition
      const shadeXs: number[] = []
      const shadeYs: number[] = []
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i]
        let match = false
        switch (queryOp) {
          case '<=': case '<': match = x <= queryK; break
          case '>=': case '>': match = x >= queryK; break
          case '=': match = false; break
        }
        if (match) { shadeXs.push(x); shadeYs.push(ys[i]) }
      }

      return {
        traces: [
          // shade
          ...(shadeXs.length > 0 ? [{
            x: shadeXs, y: shadeYs,
            type: 'scatter' as const,
            mode: 'none' as const,
            fill: 'tozeroy' as const,
            fillcolor: 'rgba(99,102,241,0.25)',
            name: opLabel(queryOp, queryK, result.queryResult),
            showlegend: true,
            hoverinfo: 'skip' as const,
          }] : []),
          // PDF curve
          {
            x: xs, y: ys,
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'PDF',
            line: { color: '#6366f1', width: 2.5 },
          },
          // query line
          {
            x: [queryK, queryK],
            y: [0, Math.max(0, ...ys.filter(y => isFinite(y))) * 1.05],
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: `x = ${queryK}`,
            line: { color: '#f59e0b', width: 1.5, dash: 'dash' as const },
          },
        ],
        layout: {
          ...LAYOUT_BASE,
          title: {
            text: `${distName} — ${opLabel(queryOp, queryK, result.queryResult)}`,
            font: { color: '#e5e7eb', size: 13 },
          },
          xaxis: { ...LAYOUT_BASE.xaxis, title: 'x' },
          yaxis: { ...LAYOUT_BASE.yaxis, title: 'Density' },
        },
      }
    }
  }, [dist, result, distName, queryOp, queryK, paramValues])

  if (!result) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg p-3 h-20 bg-[var(--color-bg-panel)] border border-[var(--color-border)]" />
          ))}
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] h-[380px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Stat cards row */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg p-3 border ${
              card.highlight
                ? 'bg-[#1e1b4b] border-[var(--color-accent)]/50'
                : 'bg-[var(--color-bg-panel)] border-[var(--color-border)]'
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${
              card.highlight ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'
            }`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {dist?.type === 'discrete' ? 'Probability Mass Function' : 'Probability Density Function'}
          </p>
          <ExportMenu
            onExportPNG={handleExportPNG}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
          />
        </div>
        <Plot
          divId={CHART_DIV_ID}
          data={traces}
          layout={layout as object}
          style={{ width: '100%', height: 380 }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
        />
      </div>

    </div>
  )
}

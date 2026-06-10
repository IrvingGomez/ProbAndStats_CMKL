import { useMemo, useCallback } from 'react'
import createPlotlyComponent from 'react-plotly.js/factory'
import Plotly from 'plotly.js-basic-dist-min'
import type { NormalPDFParams, NormalPDFResult } from '../../../hooks/useNormalPDF'
import ExportMenu from '../../../components/ExportMenu'
import { downloadChartPNG } from '../../../utils/exportPNG'
import { downloadCSV } from '../../../utils/exportCSV'

const Plot = createPlotlyComponent(Plotly)

const CHART_DIV_ID = 'normal-pdf-chart'

type Mode = 'pdf' | 'cdf'

interface NormalPDFObservationProps {
  params: NormalPDFParams
  result: NormalPDFResult | null
  mode: Mode
}


const LAYOUT_BASE = {
  autosize: true,
  margin: { l: 48, r: 20, t: 40, b: 48 },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#9ca3af', size: 11 },
  xaxis: {
    title: 'x',
    color: '#9ca3af',
    gridcolor: '#1f2937',
    zerolinecolor: '#334155',
  },
  yaxis: {
    color: '#9ca3af',
    gridcolor: '#1f2937',
    zerolinecolor: '#334155',
  },
  showlegend: true,
  legend: { font: { color: '#9ca3af', size: 10 }, bgcolor: 'transparent' },
}

export default function NormalPDFObservation({ params, result, mode }: NormalPDFObservationProps) {
  const xValues = result?.xValues ?? []
  const yValues = result?.yValues ?? []
  const cdfValues = result?.cdfValues ?? []
  const ciLow = result?.ciLow ?? 0
  const ciHigh = result?.ciHigh ?? 0
  const shadeX = result?.shadeX ?? []
  const shadeY = result?.shadeY ?? []
  const { mean, std, n, alpha } = params

  // ── Export handlers ──────────────────────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    downloadChartPNG(CHART_DIV_ID, `normal-distribution-${mode}.png`)
  }, [mode])

  const handleExportCSV = useCallback(() => {
    const rows: (string | number)[][] = [['x', 'PDF f(x)', 'CDF F(x)']]
    xValues.forEach((x, i) => rows.push([x, yValues[i] ?? 0, cdfValues[i] ?? 0]))
    downloadCSV(rows, `normal-distribution-${mode}.csv`)
  }, [xValues, yValues, cdfValues, mode])

  const handleExportPDF = useCallback(async () => {
    const { downloadPDF } = await import('../../../utils/exportPDF')
    downloadPDF({
      divId: CHART_DIV_ID,
      title: `Normal Distribution N(μ=${mean.toFixed(2)}, σ²=${(std * std).toFixed(2)})`,
      subtitle: `${((1 - alpha) * 100).toFixed(0)}% Confidence Interval: [${ciLow.toFixed(4)}, ${ciHigh.toFixed(4)}]`,
      stats: [
        { label: 'Mean μ',            value: mean.toFixed(4) },
        { label: 'Std Dev σ',         value: std.toFixed(4) },
        { label: 'Sample size n',     value: String(n) },
        { label: 'Significance α',    value: alpha.toFixed(4) },
        { label: 'CI Lower bound',    value: ciLow.toFixed(4) },
        { label: 'CI Upper bound',    value: ciHigh.toFixed(4) },
        { label: 'CI Width',          value: (ciHigh - ciLow).toFixed(4) },
        { label: 'View mode',         value: mode === 'pdf' ? 'PDF + CI' : 'CDF' },
      ],
      filename: 'normal-distribution-report.pdf',
    })
  }, [mean, std, n, alpha, ciLow, ciHigh, mode])

  const traces = useMemo(() => {
    if (mode === 'cdf') {
      return [
        {
          x: xValues,
          y: cdfValues,
          type: 'scatter' as const,
          mode: 'lines' as const,
          name: 'CDF',
          line: { color: '#6366f1', width: 2.5 },
        },
      ]
    }

    return [
      // Shaded CI region
      {
        x: shadeX,
        y: shadeY,
        type: 'scatter' as const,
        mode: 'none' as const,
        fill: 'tozeroy' as const,
        fillcolor: 'rgba(99,102,241,0.20)',
        name: `CI (${((1 - alpha) * 100).toFixed(0)}%)`,
        showlegend: true,
        hoverinfo: 'skip' as const,
      },
      // PDF curve
      {
        x: xValues,
        y: yValues,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `N(${mean.toFixed(2)}, ${std.toFixed(2)}²)`,
        line: { color: '#6366f1', width: 2.5 },
      },
      // CI lower bound
      {
        x: [ciLow, ciLow],
        y: [0, Math.max(...yValues) * 1.05],
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Lower (${ciLow.toFixed(3)})`,
        line: { color: '#f59e0b', width: 1.5, dash: 'dash' as const },
      },
      // CI upper bound
      {
        x: [ciHigh, ciHigh],
        y: [0, Math.max(...yValues) * 1.05],
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Upper (${ciHigh.toFixed(3)})`,
        line: { color: '#f59e0b', width: 1.5, dash: 'dash' as const },
      },
      // Mean line
      {
        x: [mean, mean],
        y: [0, Math.max(...yValues) * 1.05],
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Mean (${mean.toFixed(2)})`,
        line: { color: '#34d399', width: 1.5, dash: 'dot' as const },
      },
    ]
  }, [mode, xValues, yValues, cdfValues, shadeX, shadeY, mean, std, n, alpha, ciLow, ciHigh])

  const layout = useMemo(() => ({
    ...LAYOUT_BASE,
    title: {
      text: mode === 'pdf'
        ? `N(${mean.toFixed(2)}, ${std.toFixed(2)}²)  —  n=${n}, α=${alpha}`
        : `CDF  N(${mean.toFixed(2)}, ${std.toFixed(2)}²)`,
      font: { color: '#e5e7eb', size: 13 },
    },
    yaxis: {
      ...LAYOUT_BASE.yaxis,
      title: mode === 'pdf' ? 'Density' : 'Probability',
    },
  }), [mode, mean, std, n, alpha])

  if (!result) {
    return (
      <div className="flex flex-col h-full gap-4 animate-pulse">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] h-[380px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Chart panel with export menu */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] overflow-hidden">
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
            {mode === 'pdf' ? 'Probability Density Function + CI' : 'Cumulative Distribution Function'}
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
          layout={layout}
          style={{ width: '100%', height: 430 }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
        />
      </div>
    </div>
  )
}

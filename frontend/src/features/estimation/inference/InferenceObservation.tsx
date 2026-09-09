import { useMemo, useState } from 'react';
import type { IntervalsResponse, ConfidenceRegionsResponse } from '../../../api/inference';
import ReactPlotly from 'react-plotly.js';

interface InferenceObservationProps {
  ciRow?: IntervalsResponse | null;
  piRow?: IntervalsResponse | null;
  regionData?: ConfidenceRegionsResponse | null;
  isComputing: boolean;
  hasData: boolean;
  precision: number;
}

type Row = { Statistic: string; Lower: number; Upper: number; Method: string };
type PE = { mean: number; median: number; deviation: number };

function parseRows(r?: IntervalsResponse | null): Row[] {
  if (!r?.table) return [];
  try { return JSON.parse(r.table); } catch { return []; }
}

// ponytail: null for rows with no point estimate — an IQR interval centres on
// (q1+q3)/2 and a bootstrap interval on averaged quantiles, neither is the median
function pointFor(stat: string, pe: PE): number | null {
  const s = stat.toLowerCase();
  if (s.includes('mean')) return pe.mean;
  if (s.includes('median')) return pe.median;
  if (s.includes('deviation')) return pe.deviation;
  return null;
}

// ponytail: line + dot per interval, no end-caps — reads fine without them
function bracketTraces(rows: Row[], pe: PE, color: string, yaxis = 'y'): any[] {
  const lineX: (number | null)[] = [];
  const lineY: (number | null)[] = [];
  rows.forEach((r, i) => { lineX.push(r.Lower, r.Upper, null); lineY.push(i, i, null); });
  const pts = rows
    .map((r, i) => ({ x: pointFor(r.Statistic, pe), y: i, r }))
    .filter((p) => p.x !== null);
  return [
    { x: lineX, y: lineY, xaxis: 'x', yaxis, type: 'scatter', mode: 'lines', line: { color, width: 2 }, hoverinfo: 'skip' },
    {
      x: pts.map((p) => p.x),
      y: pts.map((p) => p.y),
      xaxis: 'x',
      yaxis,
      type: 'scatter',
      mode: 'markers',
      marker: { color, size: 9, symbol: 'diamond' },
      customdata: pts.map((p) => [p.r.Lower, p.r.Upper, p.r.Method]),
      hovertemplate: '[%{customdata[0]:.4g}, %{customdata[1]:.4g}]<br>%{customdata[2]}<extra></extra>',
    },
  ];
}

const yTicks = (rows: Row[]) => ({
  tickvals: rows.map((_, i) => i),
  ticktext: rows.map((r) => `${r.Statistic} · ${r.Method}`),
  range: [-0.7, rows.length - 0.3],
});

// ponytail: Plotly parses colors itself — CSS vars don't resolve, so use literals
const C_PI = '#3b82f6';
const C_CI = '#10b981';
const C_DEV = '#f59e0b';
const C_REGION = ['#f97316', '#eab308', '#22c55e', '#0ea5e9', '#a855f7'];

const AXIS = { gridcolor: 'rgba(128,128,128,0.15)', zeroline: false };
const BASE_LAYOUT = {
  autosize: true,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#888', size: 11 },
  showlegend: false,
};
const CONFIG = { responsive: true, displayModeBar: false };
const FILL = '100%';

export default function InferenceObservation({ ciRow, piRow, regionData, hasData }: InferenceObservationProps) {
  const ciRows = useMemo(() => parseRows(ciRow), [ciRow]);
  const piRows = useMemo(() => parseRows(piRow), [piRow]);
  const [zoomCI, setZoomCI] = useState(true);

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-md)] rounded-xl m-4">
        Waiting for data...
      </div>
    );
  }

  if (regionData) {
    // ponytail: Plotly's {start, end, size} draws EVENLY SPACED contours, so the
    // requested coverage levels need one trace each. Legend names double as labels.
    const data: any[] = [{
      z: regionData.z_matrix,
      x: regionData.mu_grid,
      y: regionData.sigma_grid,
      type: 'heatmap',
      colorscale: 'Viridis',
      colorbar: { title: { text: 'relative likelihood', side: 'right' }, thickness: 12, x: 1.02 },
      hovertemplate: 'μ %{x:.4g}<br>σ %{y:.4g}<br>L %{z:.3f}<extra></extra>',
    }];

    regionData.levels.forEach((level, i) => {
      const prob = regionData.probs[i];
      data.push({
        z: regionData.z_matrix,
        x: regionData.mu_grid,
        y: regionData.sigma_grid,
        type: 'contour',
        contours: { start: level, end: level, size: 1, coloring: 'lines' },
        line: { color: C_REGION[i % C_REGION.length], width: 2 },
        name: `${(prob * 100).toFixed(0)}% region`,
        showlegend: true,
        showscale: false,
        hoverinfo: 'skip',
      });
    });

    data.push({
      x: [regionData.mu_hat],
      y: [regionData.sigma_hat],
      mode: 'markers',
      type: 'scatter',
      name: 'MLE (μ̂, σ̂)',
      marker: { color: '#ef4444', size: 11, symbol: 'x' },
      hovertemplate: 'MLE: μ %{x:.4g}, σ %{y:.4g}<extra></extra>',
    });

    if (regionData.mu_ci && regionData.sigma_ci) {
      data.push({
        x: [regionData.mu_ci[0], regionData.mu_ci[1], regionData.mu_ci[1], regionData.mu_ci[0], regionData.mu_ci[0]],
        y: [regionData.sigma_ci[0], regionData.sigma_ci[0], regionData.sigma_ci[1], regionData.sigma_ci[1], regionData.sigma_ci[0]],
        mode: 'lines',
        type: 'scatter',
        name: 'Marginal CIs (μ × σ)',
        line: { color: '#ef4444', dash: 'dash', width: 2 },
        hoverinfo: 'skip',
      });
    }

    return (
      <div className="flex flex-col h-full w-full relative group p-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] px-2">
          Joint Confidence Regions for (μ, σ)
        </p>
        <ReactPlotly
          data={data}
          layout={{
            ...BASE_LAYOUT,
            margin: { l: 60, r: 90, b: 78, t: 10, pad: 4 },
            xaxis: { ...AXIS, title: { text: 'μ (mean)', standoff: 6 } },
            yaxis: { ...AXIS, title: { text: 'σ (deviation)', standoff: 6 } },
            showlegend: true,
            legend: { x: 0, y: -0.16, orientation: 'h', font: { size: 10 } },
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={CONFIG}
        />
      </div>
    );
  }

  if (ciRow || piRow) {
    const ctx = ciRow ?? piRow!;
    const pe = ctx.point_estimates;
    const edges = ctx.histogram?.binEdges ?? [];
    const centers = edges.slice(0, -1).map((lo, i) => (lo + edges[i + 1]) / 2);
    const binWidth = edges.length > 1 ? edges[1] - edges[0] : 1;

    const ciLoc = ciRows.filter((r) => !r.Statistic.toLowerCase().includes('deviation'));
    const devRow = ciRows.find((r) => r.Statistic.toLowerCase().includes('deviation'));

    // Panel 2 x-range: fit tight around the (usually narrow) location CIs
    let ciRange: [number, number] | undefined;
    if (ciLoc.length) {
      const lo = Math.min(...ciLoc.map((r) => r.Lower));
      const hi = Math.max(...ciLoc.map((r) => r.Upper));
      const pad = (hi - lo) * 0.15 || Math.abs(hi || 1) * 0.02;
      ciRange = [lo - pad, hi + pad];
    }

    const hasPI = piRows.length > 0;
    const p1Height = hasPI ? 300 : 220;

    return (
      <div className="flex flex-col h-full w-full overflow-y-auto custom-scrollbar gap-2 p-2">
        {/* Panel 1 — histogram of observations (+ prediction intervals when present) */}
        {centers.length > 0 && (
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] px-2">
              {hasPI ? 'Observations & Prediction Intervals' : 'Observations'}
            </p>
            <ReactPlotly
              data={[
                {
                  x: centers, y: ctx.histogram.counts, type: 'bar',
                  marker: { color: 'rgba(120,140,170,0.55)' }, width: binWidth,
                  hovertemplate: 'count %{y}<extra></extra>',
                },
                ...(hasPI ? bracketTraces(piRows, pe, C_PI, 'y2') : []),
              ]}
              layout={{
                ...BASE_LAYOUT,
                height: p1Height,
                margin: { l: 165, r: 16, b: 40, t: 10, pad: 4 },
                xaxis: { ...AXIS, anchor: hasPI ? 'y2' : 'y', title: { text: 'value', standoff: 6 } },
                yaxis: { ...AXIS, domain: hasPI ? [0.4, 1] : [0, 1], title: 'count' },
                ...(hasPI ? { yaxis2: { ...AXIS, domain: [0, 0.28], ...yTicks(piRows) } } : {}),
              }}
              useResizeHandler
              style={{ width: FILL, height: p1Height }}
              config={CONFIG}
            />
          </div>
        )}

        {/* Panel 2 — Mean & Median CIs over the histogram, shared x-axis, zoom toggle */}
        {ciLoc.length > 0 && (
          <div className="shrink-0">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                Confidence Intervals — Mean &amp; Median
              </p>
              <button
                type="button"
                onClick={() => setZoomCI((z) => !z)}
                className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                {zoomCI ? 'Fit to data' : 'Zoom to CI'}
              </button>
            </div>
            <ReactPlotly
              data={[
                ...(centers.length > 0 ? [{
                  x: centers, y: ctx.histogram.counts, type: 'bar',
                  marker: { color: 'rgba(120,140,170,0.55)' }, width: binWidth,
                  hovertemplate: 'count %{y}<extra></extra>',
                }] : []),
                ...bracketTraces(ciLoc, pe, C_CI, 'y2'),
              ]}
              layout={{
                ...BASE_LAYOUT,
                height: 300,
                margin: { l: 165, r: 16, b: 40, t: 10, pad: 4 },
                xaxis: {
                  ...AXIS, anchor: 'y2', title: { text: 'value', standoff: 6 },
                  ...(zoomCI && ciRange ? { range: ciRange } : { autorange: true }),
                },
                yaxis: { ...AXIS, domain: [0.4, 1], title: 'count' },
                yaxis2: { ...AXIS, domain: [0, 0.28], ...yTicks(ciLoc) },
              }}
              useResizeHandler
              style={{ width: FILL, height: 300 }}
              config={CONFIG}
            />
          </div>
        )}

        {/* Panel 3 — dispersion CI, spread units */}
        {devRow && (
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] px-2">
              Deviation CI
            </p>
            <ReactPlotly
              data={bracketTraces([devRow], pe, C_DEV)}
              layout={{
                ...BASE_LAYOUT,
                height: 110,
                margin: { l: 165, r: 16, b: 34, t: 6, pad: 4 },
                xaxis: { ...AXIS, title: { text: 'σ (data units)', standoff: 6 } },
                yaxis: { ...AXIS, ...yTicks([devRow]) },
              }}
              useResizeHandler
              style={{ width: FILL, height: 110 }}
              config={CONFIG}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">
      Run estimation to see plots or results.
    </div>
  );
}

import { useMemo } from 'react';
import ReactPlotly from 'react-plotly.js';
import type { HypothesisResponse, RejectionRegionData } from '../../api/hypothesis';

interface HypothesisObservationProps {
  result: HypothesisResponse | null;
  hasData: boolean;
  isComputing: boolean;
  revealed: boolean;
  onReveal: () => void;
}

// ponytail: Plotly parses colors itself — CSS vars don't resolve, so use literals
const C_REJECT = 'rgba(239,68,68,0.28)';
const C_P_AREA = 'rgba(59,130,246,0.45)';
const C_CURVE = '#9ca3af';
const C_CRIT = '#ef4444';
const C_STAT = '#111827';

const AXIS = { gridcolor: 'rgba(128,128,128,0.15)', zeroline: false };
const BASE_LAYOUT = {
  autosize: true,
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { color: '#888', size: 11 },
  showlegend: false,
};
const CONFIG = { responsive: true, displayModeBar: false };

const DIST_LABEL: Record<RejectionRegionData['dist'], string> = { t: 't', chi2: 'χ²', f: 'F' };

/** Statistic symbol shown on the axis and the marker, per null distribution. */
function statSymbol(dist: RejectionRegionData['dist']): string {
  return dist === 't' ? 't' : dist === 'chi2' ? 'χ²' : 'F';
}

/** The slice of the curve lying inside [lo, hi], as a filled polygon. */
function shade(region: RejectionRegionData, lo: number, hi: number, color: string) {
  const xs: number[] = [];
  const ys: number[] = [];
  region.x.forEach((x, i) => {
    if (x >= lo && x <= hi) { xs.push(x); ys.push(region.pdf[i]); }
  });
  if (xs.length === 0) return null;
  return {
    x: xs,
    y: ys,
    type: 'scatter',
    mode: 'lines',
    fill: 'tozeroy',
    fillcolor: color,
    line: { width: 0 },
    hoverinfo: 'skip',
  };
}

export default function HypothesisObservation({
  result, hasData, revealed, onReveal,
}: HypothesisObservationProps) {
  const traces = useMemo(() => {
    if (!result) return [];
    const region = result.rejection_region;
    const out: any[] = [];

    // 1. Rejection region — fixed by α, always visible. This is the answer the
    //    student is meant to read before any number appears.
    region.reject_region.forEach(([lo, hi]) => {
      const t = shade(region, lo, hi, C_REJECT);
      if (t) out.push(t);
    });

    // 2. p-value area — fixed by the observed statistic, only once revealed.
    if (revealed) {
      region.p_area.forEach(([lo, hi]) => {
        const t = shade(region, lo, hi, C_P_AREA);
        if (t) out.push(t);
      });
    }

    // 3. The null density itself.
    out.push({
      x: region.x, y: region.pdf, type: 'scatter', mode: 'lines',
      line: { color: C_CURVE, width: 2, dash: 'dot' }, hoverinfo: 'skip',
    });

    // 4. Critical value(s).
    region.critical_values.forEach((cv) => {
      out.push({
        x: [cv, cv], y: [0, region.y_max], type: 'scatter', mode: 'lines',
        line: { color: C_CRIT, width: 1.5, dash: 'dash' },
        hovertemplate: `critical ${statSymbol(region.dist)} = ${cv.toFixed(4)}<extra></extra>`,
      });
    });

    // 5. The observed statistic, drawn last so it sits on top.
    out.push({
      x: [region.statistic, region.statistic], y: [0, region.y_max],
      type: 'scatter', mode: 'lines', line: { color: C_STAT, width: 2.5 },
      hovertemplate: `${statSymbol(region.dist)} = ${region.statistic.toFixed(4)}<extra></extra>`,
    });

    return out;
  }, [result, revealed]);

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-md)] rounded-xl m-4">
        Waiting for data...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] border border-dashed border-[var(--color-border-md)] rounded-xl m-4">
        Run a test to see the rejection region.
      </div>
    );
  }

  const region = result.rejection_region;
  const dofLabel = region.dof.map((d) => (Number.isInteger(d) ? d : d.toFixed(2))).join(', ');
  const inside = region.reject;

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      <div className="flex items-baseline justify-between shrink-0">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Null distribution · {DIST_LABEL[region.dist]}({dofLabel})
        </h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          red = reject H₀ at α = {result.alpha}
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <ReactPlotly
          data={traces}
          layout={{
            ...BASE_LAYOUT,
            margin: { l: 45, r: 20, t: 10, b: 40 },
            xaxis: { ...AXIS, title: { text: `${statSymbol(region.dist)} statistic`, standoff: 6 } },
            yaxis: { ...AXIS, range: [0, region.y_max * 1.05], title: { text: 'density', standoff: 6 } },
          }}
          config={CONFIG}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {revealed
            ? `The blue area is the p-value: ${inside ? 'smaller' : 'larger'} than the red α region.`
            : 'Is the black marker inside the red region?'}
        </p>
        {!revealed && (
          <button
            type="button"
            onClick={onReveal}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold
              hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
          >
            Reveal p-value
          </button>
        )}
      </div>
    </div>
  );
}

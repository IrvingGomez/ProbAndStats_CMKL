// features/estimation/graphical/GraphicalNotebook.tsx
// Right panel: the numbers behind the picture — sample size, the estimates the
// overlays were drawn from, interval endpoints, and a contextual lesson note.

import type { GraphicalResponse } from '../../../api/graphical'

interface GraphicalNotebookProps {
  result: GraphicalResponse | null
  column: string
  graphType: string
  precision: number
  staleOverlays: string[]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3 pb-1 border-b border-[var(--color-border-md)]">
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1 text-xs">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-mono text-[var(--color-text)]">{value}</span>
    </div>
  )
}

const LESSONS: Record<string, string> = {
  Histogram:
    'The bars show density, not counts — their total area is 1, so the shape stays comparable when you change the bin count. Drag the bin control and watch the story change without the data changing.',
  PMF:
    'The empirical PMF puts one spike on every distinct value it observes. That only tells you something when the variable is genuinely discrete — on a continuous measurement every spike is just 1/n.',
  ECDF:
    'The ECDF makes no binning choice at all, so nothing about it is a judgement call. The band around it is the DKW bound: with probability 1 − α, the true CDF lies entirely inside it — everywhere at once, not point by point.',
}

export default function GraphicalNotebook({
  result, column, graphType, precision, staleOverlays,
}: GraphicalNotebookProps) {
  if (!result) {
    return (
      <div className="text-center py-10 text-[var(--color-text-muted)] text-sm italic">
        No results yet. Pick a column, then press Run for the estimator-backed overlays.
      </div>
    )
  }

  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : Number(v).toFixed(precision)

  const { summary, point_estimates: pe, interval_bands: bands, ecdf_data, alpha } = result

  return (
    <div className="flex flex-col">

      <Section title="Sample">
        <StatRow label="Variable" value={column} />
        <StatRow label="n" value={String(summary.n)} />
        <StatRow label="Unique values" value={String(summary.n_unique)} />
        {result.histogram_data && (
          <StatRow label="Bins" value={String(result.histogram_data.counts.length)} />
        )}
        {ecdf_data && <StatRow label="DKW ε" value={fmt(ecdf_data.epsilon)} />}
        {alpha != null && <StatRow label="α" value={fmt(alpha)} />}
      </Section>

      {(pe?.mu != null || pe?.sigma != null) && (
        <Section title="Overlay estimates">
          <StatRow label="μ̂" value={fmt(pe?.mu)} />
          <StatRow label="σ̂" value={fmt(pe?.sigma)} />
          {result.dist_used && (
            <StatRow
              label="Pivot"
              value={result.dist_used === 't' ? "Student's t" : 'Normal (z)'}
            />
          )}
        </Section>
      )}

      {bands && bands.length > 0 && (
        <Section title="Intervals">
          <div className="bg-[var(--color-bg)] rounded-md border border-[var(--color-border-md)] overflow-hidden">
            <table className="w-full text-left text-xs text-[var(--color-text)]">
              <thead className="bg-[var(--color-bg-input)]">
                <tr>
                  <th className="px-3 py-2 font-medium text-[var(--color-text-muted)]">Interval</th>
                  <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">Lower</th>
                  <th className="px-3 py-2 font-medium text-[var(--color-text-muted)] text-right">Upper</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-md)]">
                {bands.map((b) => (
                  <tr key={b.label} className="hover:bg-[var(--color-bg-hover)]">
                    <td className="px-3 py-2">{b.label}</td>
                    <td className="px-3 py-2 font-mono text-right text-emerald-600 dark:text-emerald-400">{fmt(b.low)}</td>
                    <td className="px-3 py-2 font-mono text-right text-emerald-600 dark:text-emerald-400">{fmt(b.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2 leading-snug">
            A confidence interval brackets a parameter; a prediction interval
            brackets the next observation. The prediction interval is wider —
            it carries the spread of the data itself, not just the uncertainty
            in the estimate.
          </p>
        </Section>
      )}

      {staleOverlays.length > 0 && (
        <Section title="Awaiting Run">
          {staleOverlays.map((o) => (
            <p key={o} className="text-xs text-amber-500/90 leading-snug mb-2">
              ● {o} is not in these numbers — press Run to resample it.
            </p>
          ))}
        </Section>
      )}

      {result.warnings.length > 0 && (
        <Section title="Notes">
          {result.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-500/90 leading-snug mb-2">⚠️ {w}</p>
          ))}
        </Section>
      )}

      <Section title="Lesson">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          {LESSONS[graphType] ?? ''}
        </p>
      </Section>
    </div>
  )
}

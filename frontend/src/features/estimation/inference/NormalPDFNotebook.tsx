import type { NormalPDFParams, NormalPDFResult } from '../../../hooks/useNormalPDF'

interface NormalPDFNotebookProps {
  params: NormalPDFParams
  result: NormalPDFResult | null
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[var(--color-border)]">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-mono text-[var(--color-text)]">{value}</span>
    </div>
  )
}

export default function NormalPDFNotebook({ params, result }: NormalPDFNotebookProps) {
  const { mean, std, n, alpha } = params
  const ciLow = result?.ciLow ?? null
  const ciHigh = result?.ciHigh ?? null
  const se = result?.se ?? null
  const zCritical = result?.zCritical ?? null
  const ci = (1 - alpha) * 100

  return (
    <div className="flex flex-col gap-4">

      {/* Live Stats */}
      <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-widest
          text-[var(--color-accent)] mb-2">
          Live Stats
        </h3>
        <StatRow label="μ (mean)"       value={mean.toFixed(4)} />
        <StatRow label="σ (std dev)"    value={std.toFixed(4)} />
        <StatRow label="n (sample size)" value={String(n)} />
        <StatRow label="α (significance)" value={alpha.toFixed(2)} />
        <StatRow label="SE = σ/√n"      value={se != null ? se.toFixed(4) : '—'} />
        <StatRow label={`z (α/2 = ${(alpha/2).toFixed(3)})`} value={zCritical != null ? zCritical.toFixed(4) : '—'} />
        <StatRow label={`CI lower (${ci.toFixed(0)}%)`} value={ciLow != null ? ciLow.toFixed(4) : '—'} />
        <StatRow label={`CI upper (${ci.toFixed(0)}%)`} value={ciHigh != null ? ciHigh.toFixed(4) : '—'} />
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-muted)]">Width: </span>
          <span className="text-xs font-mono text-emerald-400">
            {ciLow != null && ciHigh != null ? (ciHigh - ciLow).toFixed(4) : '—'}
          </span>
        </div>
      </div>

      {/* Lesson */}
      <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-widest
          text-amber-400 mb-2">
          The Lesson
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          The shaded region is the <strong className="text-[var(--color-text)]">
          {ci.toFixed(0)}% confidence interval</strong> for the population mean.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-2">
          As <strong className="text-[var(--color-text)]">n increases</strong>,
          the standard error SE&nbsp;=&nbsp;σ/√n shrinks, making the CI narrower —
          more precision from more data.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-2">
          Lowering <strong className="text-[var(--color-text)]">α</strong> (e.g.&nbsp;0.01)
          widens the CI — more confidence requires a larger net.
        </p>
      </div>

      {/* Formula */}
      <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-2">
          Formula (CI for μ, σ known)
        </h3>
        <p className="text-xs font-mono text-indigo-300 leading-loose">
          CI = μ ± z(α/2) · σ / √n
        </p>
        <p className="text-xs font-mono text-indigo-300 leading-loose">
          = {mean.toFixed(2)} ± {zCritical != null ? zCritical.toFixed(3) : '—'} · {std.toFixed(2)} / √{n}
        </p>
        <p className="text-xs font-mono text-emerald-400 leading-loose">
          = [ {ciLow != null ? ciLow.toFixed(4) : '—'}, {ciHigh != null ? ciHigh.toFixed(4) : '—'} ]
        </p>
      </div>

    </div>
  )
}

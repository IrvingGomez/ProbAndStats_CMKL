// features/estimation/descriptive/DescriptiveNotebook.tsx
// Right panel: data story narrative, "so what?" callouts, technical details, bias correction, formulas

import { type DescriptiveResult, type DescriptiveSummary } from '../../../api/descriptive'
import type { DescriptiveConfig } from './DescriptiveControls'

// ─── Narrative types ─────────────────────────────────────────────────────────

type Severity = 'info' | 'caution' | 'action'

interface SoWhat {
  severity: Severity
  text: string
}

interface NarrativeSection {
  question: string
  paragraphs: string[]
  soWhat: SoWhat
  accent: { heading: string; border: string }
}

interface NarrativeOutput {
  center: NarrativeSection
  spread: NarrativeSection
  shape: NarrativeSection
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ title, accent, children }: {
  title: string; accent?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
      <h3 className={`text-xs font-semibold uppercase tracking-widest mb-2 ${accent ?? 'text-[var(--color-accent)]'}`}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[var(--color-border)] last:border-b-0">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-mono text-[var(--color-accent)]">{value}</span>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-xs text-[var(--color-text-muted)] flex gap-1.5">
      <span className="text-[var(--color-accent)] mt-0.5 shrink-0">•</span>
      <span>{children}</span>
    </li>
  )
}

// ─── Narrative UI components ─────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, { border: string; bg: string; label: string }> = {
  info:    { border: 'border-blue-500/30',  bg: 'bg-blue-950/40',  label: 'text-blue-400'  },
  caution: { border: 'border-amber-500/30', bg: 'bg-amber-950/40', label: 'text-amber-400' },
  action:  { border: 'border-rose-500/30',  bg: 'bg-rose-950/40',  label: 'text-rose-400'  },
}

function SoWhatCallout({ soWhat }: { soWhat: SoWhat }) {
  const style = SEVERITY_STYLES[soWhat.severity]
  return (
    <div className={`rounded-md px-3 py-2 border ${style.border} ${style.bg}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest ${style.label} mb-1`}>
        So what?
      </p>
      <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
        {soWhat.text}
      </p>
    </div>
  )
}

function NarrativeCard({ section }: { section: NarrativeSection }) {
  return (
    <div className={`rounded-lg p-4 bg-[var(--color-bg-input)] border ${section.accent.border}`}>
      <h3 className={`text-sm font-semibold mb-2 ${section.accent.heading}`}>
        {section.question}
      </h3>
      <div className="flex flex-col gap-2 mb-3">
        {section.paragraphs.map((p, i) => (
          <p key={i} className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {p}
          </p>
        ))}
      </div>
      <SoWhatCallout soWhat={section.soWhat} />
    </div>
  )
}

// ─── Auto-interpretation (kept for Technical Details) ────────────────────────

function generateInterpretation(s: DescriptiveSummary, result: DescriptiveResult): {
  shape: string[]; spread: string[]; center: string[]
} {
  const { n, mean, median, std, iqr } = s

  const skewRow = result.rows.find((r) => r.measure.includes('Skewness (k-statistic)'))
  const kurtRow = result.rows.find((r) => r.measure.includes('Kurtosis (k-statistic)'))
  const skew = skewRow?.value ?? null
  const kurt = kurtRow?.value ?? null

  const shape: string[] = []
  if (skew !== null && !isNaN(skew)) {
    if (Math.abs(skew) < 0.5) shape.push(`Distribution is approximately symmetric (skewness = ${skew.toFixed(3)}).`)
    else if (skew > 0) shape.push(`Right-skewed (skewness = ${skew.toFixed(3)}): long tail toward higher values.`)
    else shape.push(`Left-skewed (skewness = ${skew.toFixed(3)}): long tail toward lower values.`)
  }
  if (kurt !== null && !isNaN(kurt)) {
    const excessKurt = kurt - 3
    if (excessKurt > 1) shape.push(`Leptokurtic (excess kurtosis = ${excessKurt.toFixed(3)}): heavier tails than Normal.`)
    else if (excessKurt < -1) shape.push(`Platykurtic (excess kurtosis = ${excessKurt.toFixed(3)}): lighter tails than Normal.`)
    else shape.push(`Mesokurtic (excess kurtosis � ${excessKurt.toFixed(3)}): tails similar to Normal.`)
  }

  const spread: string[] = []
  spread.push(`Standard deviation covers ±1σ ≈ [${(mean - std).toFixed(3)}, ${(mean + std).toFixed(3)}].`)
  spread.push(`IQR = ${iqr.toFixed(3)} captures the middle 50% of the data.`)
  const center: string[] = []
  const diff = mean - median
  if (Math.abs(diff) < 0.01 * Math.max(Math.abs(mean), Math.abs(median), 0.001)) {
    center.push(`Mean ≈ Median (${mean.toFixed(3)} ≈ ${median.toFixed(3)}): symmetric distribution.`)
  } else if (diff > 0) {
    center.push(`Mean (${mean.toFixed(3)}) > Median (${median.toFixed(3)}): consistent with right skew.`)
  } else {
    center.push(`Mean (${mean.toFixed(3)}) < Median (${median.toFixed(3)}): consistent with left skew.`)
  }
  center.push(`n = ${n} observations used in computation.`)

  return { shape, spread, center }
}

// ─── Narrative generator ─────────────────────────────────────────────────────

function fmt(v: number, dp = 3): string {
  return v.toFixed(dp)
}

function generateNarrative(
  s: DescriptiveSummary,
  result: DescriptiveResult,
  config: DescriptiveConfig,
): NarrativeOutput {
  const { n, mean, median, std, iqr } = s

  // Extract optional stats
  const hasSkewness = config.advancedStats.includes('skewness')
  const hasKurtosis = config.advancedStats.includes('kurtosis')

  const skewRow = result.rows.find(r => r.measure.includes('Skewness (k-statistic)'))
  const kurtRow = result.rows.find(r => r.measure.includes('Kurtosis (k-statistic)'))
  const skew = hasSkewness && skewRow?.value != null && !isNaN(skewRow.value) ? skewRow.value : null
  const kurt = hasKurtosis && kurtRow?.value != null && !isNaN(kurtRow.value) ? kurtRow.value : null

  const outlierCount = result.boxData.outliers.length
  const meanMedianRelDiff = Math.abs(mean - median) / Math.max(Math.abs(mean), Math.abs(median), 0.001)

  // Find robust means if enabled
  const trimRow = config.trimAlpha != null
    ? result.rows.find(r => r.advancedId === 'trimmed_mean')
    : null
  const winsorRow = config.winsorLimits != null
    ? result.rows.find(r => r.advancedId === 'winsorized_mean')
    : null

  // ── Tiny-sample guard ──
  if (n < 2) {
    const minimal = {
      question: '',
      paragraphs: ['Only one observation is available. At least two data points are needed for meaningful descriptive statistics.'],
      soWhat: { severity: 'action' as Severity, text: 'Collect more data before attempting any statistical analysis.' },
    }
    return {
      center: { ...minimal, question: "What's typical?", accent: { heading: 'text-blue-400', border: 'border-blue-500/30' } },
      spread: { ...minimal, question: 'How spread out?', accent: { heading: 'text-emerald-400', border: 'border-emerald-500/30' } },
      shape:  { ...minimal, question: 'What shape?', accent: { heading: 'text-amber-400', border: 'border-amber-500/30' } },
    }
  }

  // ── Center: "What's typical?" ──

  const centerParas: string[] = []

  centerParas.push(
    `For the ${n} observations, the average (mean) is ${fmt(mean)} and the midpoint (median) is ${fmt(median)}.`
  )

  if (meanMedianRelDiff < 0.01) {
    centerParas.push(
      'These two measures are nearly identical, suggesting the data clusters symmetrically around its center.'
    )
  } else if (mean > median) {
    centerParas.push(
      'The mean sits above the median, which often indicates some higher values are pulling the average upward.'
    )
  } else {
    centerParas.push(
      'The mean sits below the median, which often indicates some lower values are pulling the average downward.'
    )
  }

  if (trimRow?.value != null) {
    centerParas.push(
      `A trimmed mean (alpha = ${config.trimAlpha}) of ${fmt(trimRow.value)} is also available -- it drops extreme values from both tails for a more robust estimate.`
    )
  }
  if (winsorRow?.value != null) {
    centerParas.push(
      `A Winsorized mean of ${fmt(winsorRow.value)} is also available -- it caps extreme values rather than removing them.`
    )
  }

  let centerSoWhat: SoWhat
  if (n < 30) {
    centerSoWhat = {
      severity: 'caution',
      text: `With only ${n} observations, averages can be unstable. Consider collecting more data before drawing firm conclusions.`,
    }
  } else if (meanMedianRelDiff > 0.05 && outlierCount > 0) {
    centerSoWhat = {
      severity: 'action',
      text: `The mean and median disagree noticeably, and there are ${outlierCount} outlier(s). The median is likely more trustworthy here -- report both, and investigate the outliers.`,
    }
  } else if (meanMedianRelDiff > 0.05) {
    centerSoWhat = {
      severity: 'caution',
      text: 'The mean and median differ meaningfully. Consider which better represents "typical" for your context -- the median is more resistant to extreme values.',
    }
  } else {
    centerSoWhat = {
      severity: 'info',
      text: 'The mean and median agree closely. Either measure gives a reliable picture of the typical value.',
    }
  }

  // ── Spread: "How spread out?" ──

  const spreadParas: string[] = []

  spreadParas.push(
    `Values typically fall within one standard deviation of the mean, spanning roughly ${fmt(mean - std)} to ${fmt(mean + std)}. The interquartile range (middle 50%) covers ${fmt(iqr)} units.`
  )

  if (outlierCount > 0) {
    spreadParas.push(
      `The box plot identifies ${outlierCount} value(s) beyond the 1.5x IQR fences, flagged as potential outliers.`
    )
  } else {
    spreadParas.push(
      'No values fall outside the 1.5x IQR fences, so the data lacks extreme outliers.'
    )
  }

  let spreadSoWhat: SoWhat
  if (outlierCount >= 3) {
    spreadSoWhat = {
      severity: 'action',
      text: `${outlierCount} outliers detected. Investigate whether these are data errors, unusual events, or a sign that your data has multiple subgroups.`, 
    }
  } else if (outlierCount > 0) {
    spreadSoWhat = {
      severity: 'caution',
      text: `${outlierCount} mild outlier(s) detected. Worth checking, but not necessarily problematic.`, 
    }
  } else {
    spreadSoWhat = {
      severity: 'info',
      text: 'The data is relatively tightly clustered. Summary statistics should represent individual values well.',
    }
  }

  // ── Shape: "What shape?" ──

  const shapeParas: string[] = []
  let shapeSoWhat: SoWhat = { severity: 'info', text: 'Shape interpretation unavailable.' }

  if (skew !== null) {
    // Full mode with skewness
    const absSkew = Math.abs(skew)
    const dir = skew > 0 ? 'right' : 'left'
    const meanRel = skew > 0 ? 'above' : 'below'

    if (absSkew < 0.5) {
      shapeParas.push(
        `The distribution is approximately symmetric (skewness = ${fmt(skew)}), meaning values are fairly evenly spread around the center.`
      )
    } else if (absSkew < 1.0) {
      shapeParas.push(
        `The distribution shows moderate ${dir} skew (skewness = ${fmt(skew)}). There is a tail stretching toward ${dir === 'right' ? 'higher' : 'lower'} values, consistent with the mean being ${meanRel} the median noted above.`
      )
    } else {
      shapeParas.push(
        `The distribution is heavily ${dir}-skewed (skewness = ${fmt(skew)}). A long tail of ${dir === 'right' ? 'high' : 'low'} values pulls the mean well ${meanRel} the median. Standard parametric methods that assume normality may be unreliable.`
      )
    }
    if (kurt !== null) {
      const excessKurt = kurt - 3
      if (excessKurt > 1) {
        shapeParas.push(
          `The tails are heavier than a Normal distribution (excess kurtosis = ${fmt(excessKurt)}), meaning extreme values are more likely than you might expect.`
        )
      } else if (excessKurt < -1) {
        shapeParas.push(
          `The tails are lighter than a Normal distribution (excess kurtosis = ${fmt(excessKurt)}), with values more concentrated near the center.`
        )
      } else {
        shapeParas.push(
          `The tail behavior is close to Normal (excess kurtosis = ${fmt(excessKurt)}).`
        )
      }
    }

    // So What based on skewness severity
    if (absSkew >= 1.0) {
      shapeSoWhat = {
        severity: 'action',
        text: 'Heavy skew detected. Many common statistical tests assume symmetry. Consider a log or sqrt transform, use non-parametric methods, or report the median instead of the mean.',
      }
    } else if (absSkew >= 0.5) {
      shapeSoWhat = {
        severity: 'caution',
        text: 'Moderate skew. Most methods still work reasonably, but be cautious with confidence intervals and hypothesis tests that assume normality -- they may be slightly off.',
      }
    } else {
      shapeSoWhat = {
        severity: 'info',
        text: 'The distribution looks reasonably symmetric. Standard statistical methods should work well here.',
      }
    }
    // Simple mode -- no skewness stat available
    if (meanMedianRelDiff < 0.01) {
      shapeParas.push(
        'Formal skewness statistics are not enabled, but the mean and median are nearly equal -- suggesting the distribution is roughly symmetric.'
      )
    } else if (mean > median) {
      shapeParas.push(
        'Formal skewness statistics are not enabled. However, the mean sits above the median, which hints at a possible right-skewed shape.'
      )
    } else {
      shapeParas.push(
        'Formal skewness statistics are not enabled. However, the mean sits below the median, which hints at a possible left-skewed shape.'
      )
    }
    shapeParas.push(
      'Enable Skewness and Kurtosis in Advanced Statistics (left panel) for a more precise shape assessment.'
    )

    if (meanMedianRelDiff > 0.05) {
      shapeSoWhat = {
        severity: 'caution',
        text: 'The mean-median gap hints at asymmetry. Enable Skewness in Advanced Statistics for a precise measurement before choosing your analysis method.',
      }
    } else {
      shapeSoWhat = {
        severity: 'info',
        text: 'The distribution appears reasonably symmetric based on mean vs. median. Standard statistical methods should work well here.',
      }
    }
  }

  return {
    center: { question: "What's typical?", paragraphs: centerParas, soWhat: centerSoWhat, accent: { heading: 'text-blue-400', border: 'border-blue-500/30' } },
    spread: { question: 'How spread out?', paragraphs: spreadParas, soWhat: spreadSoWhat, accent: { heading: 'text-emerald-400', border: 'border-emerald-500/30' } },
    shape:  { question: 'What shape?', paragraphs: shapeParas, soWhat: shapeSoWhat, accent: { heading: 'text-amber-400', border: 'border-amber-500/30' } },
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DescriptiveNotebookProps {
  result: DescriptiveResult | null
  config: DescriptiveConfig | null
  filename: string
  filteredN: number
  rawN: number
  precision: number
}

export default function DescriptiveNotebook({
  result, config, filename, filteredN, rawN, precision,
}: DescriptiveNotebookProps) {
  if (!result || !config) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-40">
        <span className="text-2xl">📖</span>
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Run the analysis to see interpretation & notes.
        </p>
      </div>
    )
  }

  const { summary } = result
  const narrative = generateNarrative(summary, result, config)
  const interp = generateInterpretation(summary, result)

  const p = precision

  // Find consistency correction context
  const stdRow = result.rows.find((r) => r.measure === 'Std Dev (ddof=1)')
  const c4n = stdRow?.consistencyCorr != null && stdRow.value != null && stdRow.value !== 0
    ? (stdRow.value / stdRow.consistencyCorr).toFixed(6)
    : null

  return (
    <div className="flex flex-col gap-4">

      {/* Data Summary */}
      <Section title="Data Summary">
        <Row label="File" value={filename || '—'} />
        <Row label="Variable" value={config.column} />
        {config.weightsCol && <Row label="Weights" value={config.weightsCol} />}
        <Row label="Rows (filtered)" value={`${filteredN} / ${rawN}`} />
        <Row label="Obs. used (n)" value={String(summary.n)} />
        <Row label="Missing removed" value={String(filteredN - summary.n)} />
        <Row label="Precision" value={`${p} dp`} />
      </Section>

      {/* ── Data Story ── */}
      <NarrativeCard section={narrative.center} />
      <NarrativeCard section={narrative.spread} />
      <NarrativeCard section={narrative.shape} />

      {/* ── Technical Details (old bullet-point format, collapsed) ── */}
      <details className="rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] group">
        <summary className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] p-3 cursor-pointer select-none flex items-center justify-between">
          Technical Details
          <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <Section title="Central Tendency" accent="text-blue-400">
            <ul className="flex flex-col gap-1">
              {interp.center.map((s, i) => <Bullet key={i}>{s}</Bullet>)}
            </ul>
          </Section>
          <Section title="Dispersion" accent="text-emerald-400">
            <ul className="flex flex-col gap-1">
              {interp.spread.map((s, i) => <Bullet key={i}>{s}</Bullet>)}
            </ul>
          </Section>
          <Section title="Shape" accent="text-amber-400">
            <ul className="flex flex-col gap-1">
              {interp.shape.map((s, i) => <Bullet key={i}>{s}</Bullet>)}
            </ul>
          </Section>
        </div>
      </details>

      {/* Consistency Correction Notes */}
      {config.showConsistencyCorr && c4n && (
        <Section title="Consistency Correction" accent="text-[var(--color-text-muted)]">
          <ul className="flex flex-col gap-1">
            <Bullet>c₄(n={summary.n}) = {c4n} — correction factor for σ (Std Dev)</Bullet>
            <Bullet>Consistency-corrected σ = σ̂₁ / c₄(n)</Bullet>
            <Bullet>MAD / Φ⁻¹(0.75) ≈ 1.4826 × MAD — consistent estimator of σ under normality</Bullet>
            <Bullet>IQR / (2Φ⁻¹(0.75)) ≈ 0.7413 × IQR — consistent estimator of σ under normality</Bullet>
            <Bullet>AAD × √(π/2) ≈ 1.2533 × AAD — consistent estimator of σ under normality</Bullet>
          </ul>
        </Section>
      )}

      {/* Formula Reference */}
      <details className="rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] group">
        <summary className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] p-3 cursor-pointer select-none flex items-center justify-between">
          Formula Reference
          <span className="text-[10px] opacity-60 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="flex flex-col gap-2 text-[11px] font-mono text-indigo-300 leading-relaxed px-3 pb-3">
          {config.trimAlpha && (
            <div>
              <p className="text-[var(--color-text-muted)] font-sans not-italic text-[10px] mb-0.5">Trimmed Mean (α={config.trimAlpha})</p>
              x̄ₐ = (1/(n−2k)) Σxᵢ, k = ⌊αn⌋
            </div>
          )}
          {config.winsorLimits && (
            <div>
              <p className="text-[var(--color-text-muted)] font-sans not-italic text-[10px] mb-0.5">Winsorized Mean</p>
              Replace k₁ smallest → x(k₁+1),<br />
              k₂ largest → x(n−k₂)
            </div>
          )}
          <div>
            <p className="text-[var(--color-text-muted)] font-sans not-italic text-[10px] mb-0.5">MAD</p>
            MAD = median(|x - median(x)|)
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] font-sans not-italic text-[10px] mb-0.5">Skewness (Fisher)</p>
            g1 = m3 / m2^(3/2)
          </div>
          <div>
            <p className="text-[var(--color-text-muted)] font-sans not-italic text-[10px] mb-0.5">Kurtosis</p>
            g2 = m4 / m2^2
          </div>
        </div>
      </details>

    </div>
  )
}


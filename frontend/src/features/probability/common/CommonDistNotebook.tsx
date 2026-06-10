import { DISTRIBUTIONS, type DistResult, type DistParams } from '../../../hooks/useDistribution'

interface CommonDistNotebookProps {
  distParams: DistParams
  result: DistResult | null
  isLoading?: boolean
}

// ─── Formula strings per distribution ────────────────────────────────────────

const FORMULAS: Record<string, { pmfOrPdf: string; support: string; params: string }> = {
  'Poisson': {
    pmfOrPdf: 'P(X = k) = (λᵏ · e⁻λ) / k!',
    support:  'k ∈ {0, 1, 2, …}',
    params:   'λ > 0 (rate)',
  },
  'Binomial': {
    pmfOrPdf: 'P(X = k) = C(n,k) · pᵏ · (1-p)ⁿ⁻ᵏ',
    support:  'k ∈ {0, 1, …, n}',
    params:   'n ∈ ℕ, p ∈ (0,1)',
  },
  'Geometric': {
    pmfOrPdf: 'P(X = k) = p · (1-p)ᵏ⁻¹',
    support:  'k ∈ {1, 2, 3, …}',
    params:   'p ∈ (0,1)',
  },
  'Negative Binomial': {
    pmfOrPdf: 'P(X = k) = C(k+r-1, k) · pʳ · (1-p)ᵏ',
    support:  'k ∈ {0, 1, 2, …}',
    params:   'r ∈ ℕ, p ∈ (0,1)',
  },
  'Hypergeometric': {
    pmfOrPdf: 'P(X = k) = C(K,k)·C(N-K,n-k) / C(N,n)',
    support:  'k ∈ {max(0,n+K-N), …, min(n,K)}',
    params:   'N, K, n ∈ ℕ',
  },
  'Normal': {
    pmfOrPdf: 'f(x) = exp(-(x-μ)²/2σ²) / (σ√2π)',
    support:  'x ∈ ℝ',
    params:   'μ ∈ ℝ, σ > 0',
  },
  'Exponential': {
    pmfOrPdf: 'f(x) = λ · e⁻λˣ',
    support:  'x ≥ 0',
    params:   'λ > 0 (rate)',
  },
  'Uniform': {
    pmfOrPdf: 'f(x) = 1 / (b - a)',
    support:  'x ∈ [a, b]',
    params:   'a < b',
  },
  'Gamma': {
    pmfOrPdf: 'f(x) = β^α · xᵅ⁻¹ · e⁻βˣ / Γ(α)',
    support:  'x > 0',
    params:   'α > 0 (shape), β > 0 (rate)',
  },
  'Beta': {
    pmfOrPdf: 'f(x) = xᵅ⁻¹ · (1-x)^(β-1) / B(α,β)',
    support:  'x ∈ (0, 1)',
    params:   'α > 0, β > 0',
  },
  'Chi-squared': {
    pmfOrPdf: 'f(x) = x^(k/2-1) · e^(-x/2) / (2^(k/2) · Γ(k/2))',
    support:  'x > 0',
    params:   'k ∈ ℕ (degrees of freedom)',
  },
  "Student's t": {
    pmfOrPdf: 'f(x) = Γ((ν+1)/2) / (√νπ · Γ(ν/2)) · (1 + x²/ν)^(-(ν+1)/2)',
    support:  'x ∈ ℝ',
    params:   'ν > 0 (degrees of freedom)',
  },
}

// ─── Current parameter display ───────────────────────────────────────────────

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[var(--color-border)]">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-mono text-[var(--color-accent)]">{value}</span>
    </div>
  )
}

export default function CommonDistNotebook({ distParams, result }: CommonDistNotebookProps) {
  const { distName, paramValues, queryOp, queryK } = distParams
  const dist = DISTRIBUTIONS.find((d) => d.name === distName)
  const formula = FORMULAS[distName]

  const theorMean = result?.theorMean ?? '—'
  const theorVariance = result?.theorVariance ?? '—'
  const queryResult = result?.queryResult ?? null

  return (
    <div className="flex flex-col gap-4">

      {/* Current Parameters */}
      <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-accent)] mb-2">
          Current Parameters
        </h3>
        {dist?.params.map((p) => (
          <ParamRow
            key={p.key}
            label={p.label}
            value={String(paramValues[p.key] ?? p.default)}
          />
        ))}
        <ParamRow
          label="Theoretical Mean E[X]"
          value={typeof theorMean === 'number' ? theorMean.toFixed(4) : String(theorMean)}
        />
        <ParamRow
          label="Theoretical Var[X]"
          value={typeof theorVariance === 'number' ? theorVariance.toFixed(4) : String(theorVariance)}
        />
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--color-text-muted)]">
              P(X {queryOp} {queryK})
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {queryResult != null ? queryResult.toFixed(4) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Mathematical Formula */}
      {formula && (
        <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">
            Mathematical Formula
          </h3>
          <p className="text-xs font-mono text-indigo-300 leading-loose break-all">
            {formula.pmfOrPdf}
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text)]">Support: </span>
              {formula.support}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text)]">Parameters: </span>
              {formula.params}
            </p>
          </div>
        </div>
      )}

      {/* Distribution notes */}
      <div className="rounded-lg p-3 bg-[var(--color-bg-input)] border border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Key Properties
        </h3>
        <DistNotes name={distName} />
      </div>

    </div>
  )
}

function DistNotes({ name }: { name: string }) {
  const notes: Record<string, string[]> = {
    'Poisson':  [
      'Models count of events in a fixed interval.',
      'Mean = Variance = λ.',
      'Limit of Binomial(n, λ/n) as n → ∞.',
    ],
    'Binomial': [
      'Models # successes in n independent trials.',
      'Each trial has constant probability p.',
      'Sum of n Bernoulli(p) random variables.',
    ],
    'Geometric': [
      'Models # trials until first success.',
      'Memoryless property.',
      'Discrete analog of Exponential.',
    ],
    'Negative Binomial': [
      'Models # failures before r-th success.',
      'Generalization of Geometric (r = 1).',
    ],
    'Hypergeometric': [
      'Sampling without replacement.',
      'Unlike Binomial, trials are not independent.',
    ],
    'Normal': [
      'Bell-shaped, symmetric around μ.',
      'Central Limit Theorem: sum of iid → Normal.',
      '68-95-99.7 rule: μ ± {1,2,3}σ.',
    ],
    'Exponential': [
      'Models time between Poisson events.',
      'Memoryless property: P(X>s+t|X>t) = P(X>s).',
      'Rate λ = 1/mean.',
    ],
    'Uniform': [
      'All values in [a, b] equally likely.',
      'Maximum entropy distribution on [a,b].',
    ],
    'Gamma': [
      'Sum of α independent Exp(β) variables.',
      'Generalizes Exponential (α=1) and Chi-sq.',
    ],
    'Beta': [
      'Defined on [0,1]; models probabilities.',
      'Conjugate prior for Binomial in Bayesian stats.',
    ],
    'Chi-squared': [
      'Sum of k squared standard Normal variables.',
      'Used in goodness-of-fit and independence tests.',
    ],
    "Student's t": [
      'Heavier tails than Normal.',
      'Approaches Normal as ν → ∞.',
      'Used when population σ is unknown.',
    ],
  }

  const bullets = notes[name] ?? []
  return (
    <ul className="flex flex-col gap-1">
      {bullets.map((b, i) => (
        <li key={i} className="text-xs text-[var(--color-text-muted)] flex gap-1.5">
          <span className="text-[var(--color-accent)] mt-0.5">•</span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  )
}

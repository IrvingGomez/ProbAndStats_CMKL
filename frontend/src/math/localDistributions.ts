// Provisional-only local preview of the 12 distributions, mirroring
// backend/core/probability/common_distributions/distributions.py.
// Never authoritative — every result here gets overwritten by the backend
// response ~250ms later. Precision is cosmetic, not verified math.
import type { QueryOp } from '../hooks/useDistribution'
import type { DistributionResponse } from '../api/probability'

// ─── Special functions ─────────────────────────────────────────────────────

const LANCZOS_G = 7
const LANCZOS_COEF = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

function lgamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  }
  x -= 1
  let a = LANCZOS_COEF[0]
  const t = x + LANCZOS_G + 0.5
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_COEF[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

// Regularized lower incomplete gamma P(a, x) — series + continued fraction (Numerical Recipes).
function gammaSeries(a: number, x: number): number {
  const gln = lgamma(a)
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 1; n <= 200; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-15) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln)
}

function gammaContinuedFraction(a: number, x: number): number {
  const FPMIN = 1e-300
  const gln = lgamma(a)
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x)
}

// Regularized incomplete beta I_x(a, b) — continued fraction (Numerical Recipes betacf/betai).
function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 1e-15, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

function betaIncomplete(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(a, b, x)) / a
    : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b
}

// ─── Grid helpers (must match backend exactly for chart-swap parity) ──────

function discreteMaxK(distName: string, p: Record<string, number>): number {
  switch (distName) {
    case 'Poisson': return Math.ceil(p.lambda + 5 * Math.sqrt(p.lambda)) + 1
    case 'Binomial': return Math.trunc(p.n)
    case 'Geometric': return Math.ceil(1 / p.p + 10 * Math.sqrt((1 - p.p) / (p.p ** 2)))
    case 'Negative Binomial':
      return Math.ceil(
        (p.r * (1 - p.p)) / p.p + 10 * Math.sqrt((p.r * (1 - p.p)) / (p.p ** 2)),
      )
    case 'Hypergeometric': return Math.trunc(p.n)
    default: return 30
  }
}

function continuousRange(distName: string, p: Record<string, number>): [number, number] {
  switch (distName) {
    case 'Normal': return [p.mu - 4 * p.sigma, p.mu + 4 * p.sigma]
    case 'Exponential': return [0, 5 / p.lambda]
    case 'Uniform': return [Math.min(p.a, p.b) - 0.5, Math.max(p.a, p.b) + 0.5]
    case 'Gamma': return [0, (p.alpha + 4 * Math.sqrt(p.alpha)) / p.beta]
    case 'Beta': return [0, 1]
    case 'Chi-squared': return [0, p.k + 5 * Math.sqrt(2 * p.k)]
    case "Student's t": { const bound = Math.min(5.0, p.nu + 3); return [-bound, bound] }
    default: return [-5, 5]
  }
}

function linspace(lo: number, hi: number, n: number): number[] {
  if (n === 1) return [lo]
  const step = (hi - lo) / (n - 1)
  return Array.from({ length: n }, (_, i) => lo + step * i)
}

function safeStat(v: number): number | string {
  return Number.isFinite(v) ? v : '∞'
}

function nanToZero(v: number): number {
  return Number.isNaN(v) ? 0 : v
}

function nanToNumQuery(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v === Infinity) return 1
  if (v === -Infinity) return 0
  return v
}

// ─── Per-distribution rv (pmf/pdf + cdf + theoretical stats) ──────────────

type DiscreteRV = { isDiscrete: true; pmf: (k: number) => number; cdf: (k: number) => number; mean: number; variance: number }
type ContinuousRV = { isDiscrete: false; pdf: (x: number) => number; cdf: (x: number) => number; mean: number; variance: number }
type RV = DiscreteRV | ContinuousRV

function makeRV(distName: string, p: Record<string, number>): RV {
  switch (distName) {
    case 'Poisson': {
      const lambda = p.lambda
      return {
        isDiscrete: true,
        pmf: (k) => (k < 0 ? 0 : Math.exp(k * Math.log(lambda) - lambda - lgamma(k + 1))),
        cdf: (k) => (k < 0 ? 0 : 1 - gammaP(k + 1, lambda)),
        mean: lambda, variance: lambda,
      }
    }
    case 'Binomial': {
      const n = p.n, prob = p.p
      return {
        isDiscrete: true,
        pmf: (k) => (k < 0 || k > n ? 0 : Math.exp(
          lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(prob) + (n - k) * Math.log(1 - prob),
        )),
        cdf: (k) => (k < 0 ? 0 : k >= n ? 1 : betaIncomplete(1 - prob, n - k, k + 1)),
        mean: n * prob, variance: n * prob * (1 - prob),
      }
    }
    case 'Geometric': {
      const prob = p.p
      return {
        isDiscrete: true,
        pmf: (k) => (k < 1 ? 0 : prob * Math.pow(1 - prob, k - 1)),
        cdf: (k) => (k < 1 ? 0 : 1 - Math.pow(1 - prob, k)),
        mean: 1 / prob, variance: (1 - prob) / (prob * prob),
      }
    }
    case 'Negative Binomial': {
      const r = p.r, prob = p.p
      return {
        isDiscrete: true,
        pmf: (k) => (k < 0 ? 0 : Math.exp(
          lgamma(k + r) - lgamma(k + 1) - lgamma(r) + r * Math.log(prob) + k * Math.log(1 - prob),
        )),
        cdf: (k) => (k < 0 ? 0 : betaIncomplete(prob, r, k + 1)),
        mean: (r * (1 - prob)) / prob, variance: (r * (1 - prob)) / (prob * prob),
      }
    }
    case 'Hypergeometric': {
      const N = p.N, K = p.K, n = p.n
      const logC = (a: number, b: number) => lgamma(a + 1) - lgamma(b + 1) - lgamma(a - b + 1)
      const pmf = (k: number) => {
        if (k < 0 || k > n || k > K || n - k > N - K) return 0
        return Math.exp(logC(K, k) + logC(N - K, n - k) - logC(N, n))
      }
      const cdf = (k: number) => {
        if (k < 0) return 0
        const kk = Math.min(Math.floor(k), n)
        let s = 0
        for (let i = 0; i <= kk; i++) s += pmf(i)
        return s
      }
      return {
        isDiscrete: true, pmf, cdf,
        mean: (n * K) / N,
        variance: n * (K / N) * (1 - K / N) * ((N - n) / (N - 1)),
      }
    }
    case 'Normal': {
      const mu = p.mu, sigma = p.sigma
      return {
        isDiscrete: false,
        pdf: (x) => (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2),
        cdf: (x) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2))),
        mean: mu, variance: sigma * sigma,
      }
    }
    case 'Exponential': {
      const lambda = p.lambda
      return {
        isDiscrete: false,
        pdf: (x) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
        cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
        mean: 1 / lambda, variance: 1 / (lambda * lambda),
      }
    }
    case 'Uniform': {
      const a = p.a, b = p.b
      return {
        isDiscrete: false,
        pdf: (x) => (x >= a && x <= b ? 1 / (b - a) : 0),
        cdf: (x) => (x < a ? 0 : x > b ? 1 : (x - a) / (b - a)),
        mean: (a + b) / 2, variance: (b - a) ** 2 / 12,
      }
    }
    case 'Gamma': {
      const alpha = p.alpha, beta = p.beta
      return {
        isDiscrete: false,
        pdf: (x) => (x <= 0 ? 0 : Math.exp(alpha * Math.log(beta) + (alpha - 1) * Math.log(x) - beta * x - lgamma(alpha))),
        cdf: (x) => (x <= 0 ? 0 : gammaP(alpha, beta * x)),
        mean: alpha / beta, variance: alpha / (beta * beta),
      }
    }
    case 'Beta': {
      const alpha = p.alpha, beta = p.beta
      return {
        isDiscrete: false,
        pdf: (x) => (x <= 0 || x >= 1 ? 0 : Math.exp(
          (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - (lgamma(alpha) + lgamma(beta) - lgamma(alpha + beta)),
        )),
        cdf: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : betaIncomplete(x, alpha, beta)),
        mean: alpha / (alpha + beta),
        variance: (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)),
      }
    }
    case 'Chi-squared': {
      const k = p.k
      return {
        isDiscrete: false,
        pdf: (x) => (x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lgamma(k / 2))),
        cdf: (x) => (x <= 0 ? 0 : gammaP(k / 2, x / 2)),
        mean: k, variance: 2 * k,
      }
    }
    case "Student's t": {
      const nu = p.nu
      return {
        isDiscrete: false,
        pdf: (x) => Math.exp(
          lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - ((nu + 1) / 2) * Math.log(1 + (x * x) / nu),
        ),
        cdf: (x) => {
          const xt = nu / (nu + x * x)
          const ib = betaIncomplete(xt, nu / 2, 0.5)
          return x > 0 ? 1 - 0.5 * ib : x < 0 ? 0.5 * ib : 0.5
        },
        mean: nu > 1 ? 0 : NaN,
        variance: nu > 2 ? nu / (nu - 2) : nu > 1 ? Infinity : NaN,
      }
    }
    default:
      throw new Error(`Unknown distribution: ${distName}`)
  }
}

// ─── Main entry point (mirrors compute_distribution) ──────────────────────

export function computeLocalDistribution(
  distName: string,
  params: Record<string, number>,
  queryOp: QueryOp,
  queryK: number,
): DistributionResponse {
  const rv = makeRV(distName, params)
  const theorMean = safeStat(rv.mean)
  const theorVariance = safeStat(rv.variance)

  let qRaw: number
  if (rv.isDiscrete) {
    const k = Math.round(queryK)
    switch (queryOp) {
      case '=': qRaw = rv.pmf(k); break
      case '<=': qRaw = rv.cdf(k); break
      case '<': qRaw = rv.cdf(k - 1); break
      case '>=': qRaw = 1 - rv.cdf(k - 1); break
      case '>': qRaw = 1 - rv.cdf(k); break
    }
  } else {
    switch (queryOp) {
      case '<=': case '<': qRaw = rv.cdf(queryK); break
      case '>=': case '>': qRaw = 1 - rv.cdf(queryK); break
      case '=': qRaw = rv.pdf(queryK); break
    }
  }

  let queryResult = nanToNumQuery(qRaw)
  if (!(!rv.isDiscrete && queryOp === '=')) {
    queryResult = Math.max(0, Math.min(1, queryResult))
  }

  if (rv.isDiscrete) {
    const maxK = Math.min(discreteMaxK(distName, params), 60)
    const ks: number[] = []
    const probs: number[] = []
    const cumProbs: number[] = []
    for (let k = 0; k <= maxK; k++) {
      ks.push(k)
      probs.push(nanToZero(rv.pmf(k)))
      cumProbs.push(nanToZero(rv.cdf(k)))
    }
    return { ks, probs, cumProbs, queryResult, theorMean, theorVariance }
  } else {
    const [lo, hi] = continuousRange(distName, params)
    const xs = linspace(lo, hi, 201)
    const ys = xs.map((x) => nanToZero(rv.pdf(x)))
    const cdfYs = xs.map((x) => nanToZero(rv.cdf(x)))
    return { xs, ys, cdfYs, queryResult, theorMean, theorVariance }
  }
}

import * as Comlink from 'comlink'

export interface StatRow {
  category: 'Quantiles' | 'Central Tendency' | 'Dispersion' | 'Shape' | 'Extremes'
  measure: string
  value: number | null
  consistencyCorr: number | null   // consistency-corrected value, if applicable
  robust?: boolean
  advancedId?: string
  warning?: string
}

export interface DescriptiveSummary {
  n: number
  mean: number
  median: number
  std: number
  iqr: number
}

export interface HistogramData {
  binEdges: number[]
  counts: number[]
}

export interface DescriptiveResult {
  rows: StatRow[]
  summary: DescriptiveSummary
  histogram: HistogramData
  boxData: {
    min: number; q1: number; median: number; q3: number; max: number
    outliers: number[]
  }
}

export interface DescriptiveInput {
  data: number[]
  quantileProbs: number[]
  trimAlpha: number | null
  winsorLimits: [number, number] | null
  weights: number[] | null
}

// ─── Math utilities ────────────────────────────────────────────────────────────

function sorted(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b)
}

function quantile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return NaN
  if (sortedArr.length === 1) return sortedArr[0]
  const n = sortedArr.length
  const h = (n - 1) * p
  const lo = Math.floor(h)
  const hi = Math.ceil(h)
  if (lo === hi) return sortedArr[lo]
  return sortedArr[lo] + (h - lo) * (sortedArr[hi] - sortedArr[lo])
}

function mean(arr: number[]): number {
  if (arr.length === 0) return NaN
  return arr.reduce((s, x) => s + x, 0) / arr.length
}

function geometricMean(arr: number[]): number {
  const pos = arr.filter((x) => x > 0)
  if (pos.length === 0) return NaN
  const logMean = pos.reduce((s, x) => s + Math.log(x), 0) / pos.length
  return Math.exp(logMean)
}

function harmonicMean(arr: number[]): number {
  const pos = arr.filter((x) => x > 0)
  if (pos.length === 0) return NaN
  return pos.length / pos.reduce((s, x) => s + 1 / x, 0)
}

function trimmedMean(sortedArr: number[], alpha: number): number {
  const n = sortedArr.length
  if (n === 0 || alpha < 0 || alpha >= 0.5) return NaN
  const k = Math.floor(alpha * n)
  const trimmed = sortedArr.slice(k, n - k)
  return mean(trimmed)
}

function winsorizedMean(sortedArr: number[], limits: [number, number]): number {
  const n = sortedArr.length
  if (n === 0) return NaN
  const kLo = Math.floor(limits[0] * n)
  const kHi = Math.floor(limits[1] * n)
  const winsorized = sortedArr.map((x, i) => {
    if (i < kLo) return sortedArr[kLo]
    if (i >= n - kHi) return sortedArr[n - kHi - 1]
    return x
  })
  return mean(winsorized)
}

function weightedMean(arr: number[], weights: number[]): number {
  if (arr.length === 0 || weights.length !== arr.length) return NaN
  const wSum = weights.reduce((s, w) => s + w, 0)
  if (wSum === 0) return NaN
  return arr.reduce((s, x, i) => s + x * weights[i], 0) / wSum
}

function variance(arr: number[], ddof = 1): number {
  const n = arr.length
  if (n <= ddof) return NaN
  const m = mean(arr)
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / (n - ddof)
}

function mad(sortedArr: number[]): number {
  const med = quantile(sortedArr, 0.5)
  const deviations = sorted(sortedArr.map((x) => Math.abs(x - med)))
  return quantile(deviations, 0.5)
}

function aad(arr: number[]): number {
  const m = mean(arr)
  return arr.reduce((s, x) => s + Math.abs(x - m), 0) / arr.length
}

function skewness(arr: number[]): number {
  const n = arr.length
  if (n < 3) return NaN
  const m = mean(arr)
  const s = Math.sqrt(variance(arr, 0))
  return arr.reduce((acc, x) => acc + ((x - m) / s) ** 3, 0) / n
}

function skewnessUnbiased(arr: number[]): number {
  const n = arr.length
  if (n < 3) return NaN
  const g1 = skewness(arr)
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * g1
}

function kurtosis(arr: number[]): number {
  const n = arr.length
  if (n < 4) return NaN
  const m = mean(arr)
  const s = Math.sqrt(variance(arr, 0))
  const k4 = arr.reduce((acc, x) => acc + ((x - m) / s) ** 4, 0) / n
  return k4 - 3
}

function kurtosisUnbiased(arr: number[]): number {
  const n = arr.length
  if (n < 4) return NaN
  const k = kurtosis(arr) + 3
  return (((n + 1) * (n - 1)) / ((n - 2) * (n - 3))) * (k - 3 * (n - 1) / (n + 1))
}

function c4(n: number): number {
  if (n < 2) return NaN
  return Math.sqrt(2 / (n - 1)) * Math.exp(
    lgamma(n / 2) - lgamma((n - 1) / 2)
  )
}

function d2(n: number): number {
  const table: Record<number, number> = {
    2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534, 7: 2.704,
    8: 2.847, 9: 2.970, 10: 3.078, 11: 3.173, 12: 3.258, 13: 3.336,
    14: 3.407, 15: 3.472, 20: 3.735, 25: 3.931, 30: 4.086, 50: 4.498,
    100: 5.015, 200: 5.492, 500: 6.073,
  }
  if (n in table) return table[n]
  return 0.8865 + 1.8945 * Math.log(n)
}

function lgamma(x: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function buildHistogram(sortedArr: number[], maxBins = 50): HistogramData {
  const n = sortedArr.length
  if (n < 2) return { binEdges: [], counts: [] }

  const q1v = quantile(sortedArr, 0.25)
  const q3v = quantile(sortedArr, 0.75)
  const iqrV = q3v - q1v
  const dataRange = sortedArr[n - 1] - sortedArr[0]

  let numBins: number
  if (iqrV === 0) {
    numBins = Math.min(30, Math.ceil(Math.sqrt(n)))
  } else {
    const binWidth = 2 * (iqrV / Math.cbrt(n))
    numBins = Math.min(maxBins, Math.max(5, Math.ceil(dataRange / binWidth)))
  }

  const binWidth = dataRange / numBins
  const edges: number[] = Array.from({ length: numBins + 1 }, (_, i) =>
    sortedArr[0] + i * binWidth
  )

  const counts = new Array<number>(numBins).fill(0)
  for (const x of sortedArr) {
    let bin = Math.floor((x - sortedArr[0]) / binWidth)
    if (bin >= numBins) bin = numBins - 1
    counts[bin]++
  }

  return { binEdges: edges, counts }
}

// Φ⁻¹(0.75) — used for consistency corrections of MAD, IQR, AAD under normality
const NORM_PPF_75 = 0.6744897501960817

const descriptiveStatsWorker = {
  computeDescriptiveStats(input: DescriptiveInput): DescriptiveResult | null {
    const { data, quantileProbs, trimAlpha, winsorLimits, weights } = input
    if (data.length === 0) return null

    const s = sorted(data)
    const n = s.length
    const rows: StatRow[] = []

    if (n > 0) {
      rows.push({ category: 'Extremes', measure: 'Minimum', value: s[0], consistencyCorr: null, robust: false })
      rows.push({ category: 'Extremes', measure: 'Maximum', value: s[n - 1], consistencyCorr: null, robust: false })
    }

    for (const p of quantileProbs) {
      rows.push({
        category: 'Quantiles',
        measure: `Q${p.toFixed(2)} (p=${p})`,
        value: quantile(s, p),
        consistencyCorr: null,
        robust: true,
      })
    }

    const μ = mean(data)
    const med = quantile(s, 0.5)

    rows.push({ category: 'Central Tendency', measure: 'Mean', value: μ, consistencyCorr: null, robust: false })
    rows.push({ category: 'Central Tendency', measure: 'Median', value: med, consistencyCorr: null, robust: true })
    rows.push({ category: 'Central Tendency', measure: 'Interquartile Mean (IQM)', value: trimmedMean(s, 0.25), consistencyCorr: null, robust: true, advancedId: 'iqm' })

    if (trimAlpha !== null && trimAlpha > 0) {
      rows.push({
        category: 'Central Tendency',
        measure: `Trimmed Mean (α=${trimAlpha})`,
        value: trimmedMean(s, trimAlpha),
        consistencyCorr: null,
        robust: true,
        advancedId: 'trimmed_mean',
      })
    }

    if (winsorLimits !== null) {
      rows.push({
        category: 'Central Tendency',
        measure: `Winsorized Mean (${winsorLimits[0]}, ${winsorLimits[1]})`,
        value: winsorizedMean(s, winsorLimits),
        consistencyCorr: null,
        robust: true,
        advancedId: 'winsorized_mean',
      })
    }

    const gm = geometricMean(data)
    const hasNonPositiveGM = data.some(x => x <= 0)
    rows.push({
      category: 'Central Tendency',
      measure: 'Geometric Mean',
      value: isNaN(gm) ? null : gm,
      consistencyCorr: null,
      robust: false,
      advancedId: 'geometric_mean',
      warning: hasNonPositiveGM
        ? `${data.filter(x => x <= 0).length} non-positive value(s) excluded — geometric mean requires strictly positive data`
        : undefined,
    })

    const hm = harmonicMean(data)
    const hasNonPositiveHM = data.some(x => x <= 0)
    rows.push({
      category: 'Central Tendency',
      measure: 'Harmonic Mean',
      value: isNaN(hm) ? null : hm,
      consistencyCorr: null,
      robust: false,
      advancedId: 'harmonic_mean',
      warning: hasNonPositiveHM
        ? `${data.filter(x => x <= 0).length} non-positive value(s) excluded — harmonic mean requires strictly positive data`
        : undefined,
    })

    if (weights && weights.length === n) {
      rows.push({
        category: 'Central Tendency',
        measure: 'Weighted Mean',
        value: weightedMean(data, weights),
        consistencyCorr: null,
        robust: false,
        advancedId: 'weighted_mean',
      })
    }

    const varBiased = variance(data, 0)
    const varUnbiased = variance(data, 1)
    const stdBiased = Math.sqrt(varBiased)
    const stdUnbiased = Math.sqrt(varUnbiased)
    const c4n = c4(n)
    const stdConsistencyCorr = stdUnbiased / c4n

    rows.push({ category: 'Dispersion', measure: 'Variance (ddof=0)', value: varBiased, consistencyCorr: varUnbiased, robust: false, advancedId: 'variance_0' })
    rows.push({ category: 'Dispersion', measure: 'Variance (ddof=1)', value: varUnbiased, consistencyCorr: varUnbiased, robust: false, advancedId: 'variance_1' })
    rows.push({
      category: 'Dispersion',
      measure: 'Std Dev (ddof=0)',
      value: stdBiased,
      consistencyCorr: stdConsistencyCorr,
      robust: false,
      advancedId: 'std_dev_0',
    })
    rows.push({
      category: 'Dispersion',
      measure: 'Std Dev (ddof=1)',
      value: stdUnbiased,
      consistencyCorr: stdConsistencyCorr,
      robust: false,
    })

    const dataRange = s[n - 1] - s[0]
    const d2n = d2(n)
    rows.push({
      category: 'Dispersion',
      measure: 'Range',
      value: dataRange,
      consistencyCorr: dataRange / d2n,
      robust: false,
      advancedId: 'range',
    })

    const q1v = quantile(s, 0.25)
    const q3v = quantile(s, 0.75)
    const iqrV = q3v - q1v
    const madV = mad(s)
    const aadV = aad(data)
    rows.push({ category: 'Dispersion', measure: 'IQR (Q75 - Q25)', value: iqrV, consistencyCorr: iqrV / (2 * NORM_PPF_75), robust: true, advancedId: 'iqr' })
    rows.push({ category: 'Dispersion', measure: 'MAD (Median Abs Dev)', value: madV, consistencyCorr: madV / NORM_PPF_75, robust: true, advancedId: 'mad' })
    rows.push({ category: 'Dispersion', measure: 'AAD (Mean Abs Dev)', value: aadV, consistencyCorr: aadV * Math.sqrt(Math.PI / 2), robust: false, advancedId: 'aad' })

    {
      const meanIsZero = μ === 0
      const meanNearZero = !meanIsZero && Math.abs(μ) < Math.abs(stdUnbiased) * 0.01
      rows.push({
        category: 'Dispersion',
        measure: 'CoV (σ/μ)',
        value: meanIsZero ? null : stdUnbiased / μ,
        consistencyCorr: meanIsZero ? null : stdConsistencyCorr / μ,
        robust: false,
        advancedId: 'cov',
        warning: meanIsZero
          ? 'Undefined — mean is zero'
          : meanNearZero
            ? 'Unreliable — mean is near zero relative to std dev'
            : undefined,
      })
    }

    rows.push({
      category: 'Shape',
      measure: 'Skewness (k-statistic)',
      value: skewnessUnbiased(data),
      consistencyCorr: null,
      robust: false,
      advancedId: 'skewness',
      warning: stdBiased === 0 ? 'Undefined — all values are identical' : undefined,
    })
    rows.push({
      category: 'Shape',
      measure: 'Kurtosis (k-statistic)',
      value: kurtosisUnbiased(data) + 3,
      consistencyCorr: null,
      robust: false,
      advancedId: 'kurtosis',
      warning: stdBiased === 0 ? 'Undefined — all values are identical' : undefined,
    })

    const summary: DescriptiveSummary = {
      n,
      mean: μ,
      median: med,
      std: stdUnbiased,
      iqr: iqrV,
    }

    const histogram = buildHistogram(s)

    const iqrFence = 1.5 * iqrV
    const lowerFence = q1v - iqrFence
    const upperFence = q3v + iqrFence
    const outliers = s.filter((x) => x < lowerFence || x > upperFence)
    const whiskerLo = s.find((x) => x >= lowerFence) ?? s[0]
    const whiskerHi = [...s].reverse().find((x) => x <= upperFence) ?? s[n - 1]

    return {
      rows,
      summary,
      histogram,
      boxData: {
        min: whiskerLo,
        q1: q1v,
        median: med,
        q3: q3v,
        max: whiskerHi,
        outliers,
      },
    }
  }
}

export type DescriptiveStatsWorker = typeof descriptiveStatsWorker

// Export for unit testing (Comlink is not available in Node/vitest environment)
export { descriptiveStatsWorker }

Comlink.expose(descriptiveStatsWorker)


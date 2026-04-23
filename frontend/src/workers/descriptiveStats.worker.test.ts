// descriptiveStats.worker.test.ts
// Unit tests for edge cases in descriptiveStatsWorker.computeDescriptiveStats
// Run with: npm test

import { vi, describe, it, expect } from 'vitest'

// Mock Comlink so the worker file can be imported without a real Worker environment
vi.mock('comlink', () => ({ expose: vi.fn() }))

import { descriptiveStatsWorker, type StatRow } from './descriptiveStats.worker'

const BASE_INPUT = {
  quantileProbs: [0.25, 0.5, 0.75],
  trimAlpha: null,
  winsorLimits: null,
  weights: null,
}

function getRow(rows: StatRow[], measure: string): StatRow {
  const row = rows.find((r) => r.measure === measure)
  if (!row) throw new Error(`Row "${measure}" not found`)
  return row
}

function compute(data: number[]) {
  const result = descriptiveStatsWorker.computeDescriptiveStats({ ...BASE_INPUT, data })
  if (!result) throw new Error('computeDescriptiveStats returned null')
  return result
}

// ─── Geometric Mean ────────────────────────────────────────────────────────────

describe('Geometric Mean', () => {
  it('computes correctly for all-positive data', () => {
    const { rows } = compute([1, 2, 4, 8])
    const row = getRow(rows, 'Geometric Mean')
    expect(row).toBeDefined()
    expect(row.value).toBeCloseTo(2.828, 2) // (1*2*4*8)^(1/4) = 4^0.75 ≈ 2.828
    expect(row.warning).toBeUndefined()
  })

  it('shows row (not null) when data contains zeros', () => {
    const { rows } = compute([0, 1, 2, 3])
    const row = getRow(rows, 'Geometric Mean')
    expect(row).toBeDefined()
    expect(row.value).not.toBeNull() // computes on positive subset [1,2,3]
    expect(row.warning).toMatch(/non-positive/)
    expect(row.warning).toMatch(/1/) // 1 zero excluded
  })

  it('shows row with null value when ALL values are non-positive', () => {
    const { rows } = compute([0, -1, -2])
    const row = getRow(rows, 'Geometric Mean')
    expect(row).toBeDefined()
    expect(row.value).toBeNull()
    expect(row.warning).toMatch(/non-positive/)
  })

  it('shows warning when data contains negatives', () => {
    const { rows } = compute([-3, 1, 2, 4])
    const row = getRow(rows, 'Geometric Mean')
    expect(row.warning).toMatch(/non-positive/)
    expect(row.warning).toMatch(/1/) // 1 negative excluded
  })
})

// ─── Harmonic Mean ─────────────────────────────────────────────────────────────

describe('Harmonic Mean', () => {
  it('computes correctly for all-positive data', () => {
    const { rows } = compute([1, 2, 4])
    const row = getRow(rows, 'Harmonic Mean')
    expect(row).toBeDefined()
    // HM(1,2,4) = 3 / (1 + 0.5 + 0.25) = 3 / 1.75 ≈ 1.714
    expect(row.value).toBeCloseTo(1.714, 2)
    expect(row.warning).toBeUndefined()
  })

  it('excludes negative values and warns (not just zeros)', () => {
    const { rows } = compute([-2, 1, 2, 4])
    const row = getRow(rows, 'Harmonic Mean')
    expect(row).toBeDefined()
    expect(row.warning).toMatch(/non-positive/)
    expect(row.value).not.toBeNull() // still computed from [1,2,4]
  })

  it('shows row with null value when all values are zero or negative', () => {
    const { rows } = compute([0, -1, -2])
    const row = getRow(rows, 'Harmonic Mean')
    expect(row).toBeDefined()
    expect(row.value).toBeNull()
    expect(row.warning).toMatch(/non-positive/)
  })

  it('shows row with null value when data is all zeros', () => {
    const { rows } = compute([0, 0, 0])
    const row = getRow(rows, 'Harmonic Mean')
    expect(row).toBeDefined()
    expect(row.value).toBeNull()
    expect(row.warning).toBeDefined()
  })
})

// ─── Coefficient of Variation (CoV) ───────────────────────────────────────────

describe('CoV (σ/μ)', () => {
  it('computes correctly for normal data', () => {
    const { rows } = compute([10, 20, 30, 40, 50])
    const row = getRow(rows, 'CoV (σ/μ)')
    expect(row).toBeDefined()
    expect(row.value).not.toBeNull()
    expect(row.warning).toBeUndefined()
  })

  it('shows row with null value when mean is exactly zero', () => {
    const { rows } = compute([-2, -1, 0, 1, 2])
    const row = getRow(rows, 'CoV (σ/μ)')
    expect(row).toBeDefined()
    expect(row.value).toBeNull()
    expect(row.warning).toMatch(/mean is zero/)
  })

  it('warns when mean is near zero relative to std dev', () => {
    // Data centered nearly at 0 but not exactly
    const { rows } = compute([-100, -99, 99, 100, 0.001])
    const row = getRow(rows, 'CoV (σ/μ)')
    expect(row).toBeDefined()
    // mean ≈ 0.0002, std ≈ ~86 — mean is tiny relative to std
    expect(row.warning).toMatch(/near zero/)
  })
})

// ─── Skewness ─────────────────────────────────────────────────────────────────

describe('Skewness', () => {
  it('computes correctly for varied data', () => {
    const { rows } = compute([1, 2, 3, 4, 100]) // right-skewed
    const row = getRow(rows, 'Skewness (k-statistic)')
    expect(row).toBeDefined()
    expect(row.value).not.toBeNull()
    expect(typeof row.value).toBe('number')
    expect(row.warning).toBeUndefined()
  })

  it('returns NaN-equivalent (null/NaN value) and warns for constant data', () => {
    const { rows } = compute([5, 5, 5, 5, 5])
    const row = getRow(rows, 'Skewness (k-statistic)')
    expect(row).toBeDefined()
    expect(row.warning).toMatch(/identical/)
    // value is NaN (JS NaN, not null — the function returns NaN when std=0)
    expect(row.value === null || (typeof row.value === 'number' && isNaN(row.value))).toBe(true)
  })
})

// ─── Kurtosis ─────────────────────────────────────────────────────────────────

describe('Kurtosis', () => {
  it('computes correctly for normal-ish data', () => {
    const { rows } = compute([1, 2, 3, 4, 5, 6, 7, 8])
    const row = getRow(rows, 'Kurtosis (k-statistic)')
    expect(row).toBeDefined()
    expect(typeof row.value).toBe('number')
    expect(row.warning).toBeUndefined()
  })

  it('warns for constant data', () => {
    const { rows } = compute([7, 7, 7, 7, 7])
    const row = getRow(rows, 'Kurtosis (k-statistic)')
    expect(row).toBeDefined()
    expect(row.warning).toMatch(/identical/)
  })
})

// ─── Snackbar integration: warnings surface correctly ─────────────────────────

describe('Warning propagation', () => {
  it('no rows have warnings for clean all-positive data', () => {
    const { rows } = compute([10, 20, 30, 40, 50])
    const warningRows = rows.filter(r => r.warning)
    expect(warningRows).toHaveLength(0)
  })

  it('multiple warnings present when data has zeros and negatives', () => {
    const { rows } = compute([0, -5, 1, 2, 3])
    const warningRows = rows.filter(r => r.warning)
    // Geometric Mean + Harmonic Mean should both warn
    const measures = warningRows.map((r: any) => r.measure)
    expect(measures).toContain('Geometric Mean')
    expect(measures).toContain('Harmonic Mean')
  })
})



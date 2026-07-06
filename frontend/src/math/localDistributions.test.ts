import { describe, it, expect } from 'vitest'
import { computeLocalDistribution } from './localDistributions'

describe('computeLocalDistribution', () => {
  it('Normal cdf at x=mu is 0.5', () => {
    const r = computeLocalDistribution('Normal', { mu: 0, sigma: 1 }, '<=', 0)
    expect(r.queryResult).toBeCloseTo(0.5, 6)
  })

  it('Binomial(20,0.5) pmf sums to 1 and P(X<=10) matches closed form', () => {
    const r = computeLocalDistribution('Binomial', { n: 20, p: 0.5 }, '<=', 10)
    const sum = (r.probs ?? []).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 3)
    expect(r.queryResult).toBeCloseTo(0.5881, 3)
  })

  it('Poisson mean/variance equal lambda, cdf(2) matches closed form', () => {
    const r = computeLocalDistribution('Poisson', { lambda: 4 }, '<=', 2)
    expect(r.theorMean).toBe(4)
    expect(r.theorVariance).toBe(4)
    expect(r.queryResult).toBeCloseTo(0.238103, 5)
  })

  it('Gamma(2,1) cdf(2) matches closed-form Erlang CDF', () => {
    const r = computeLocalDistribution('Gamma', { alpha: 2, beta: 1 }, '<=', 2)
    expect(r.queryResult).toBeCloseTo(0.593994, 5)
  })

  it('Beta(2,2) cdf(0.5) is 0.5 by symmetry', () => {
    const r = computeLocalDistribution('Beta', { alpha: 2, beta: 2 }, '<=', 0.5)
    expect(r.queryResult).toBeCloseTo(0.5, 6)
  })

  it("Student's t cdf(0) is 0.5 and matches df=10 critical value table", () => {
    const r0 = computeLocalDistribution("Student's t", { nu: 10 }, '<=', 0)
    expect(r0.queryResult).toBeCloseTo(0.5, 6)
    const r1 = computeLocalDistribution("Student's t", { nu: 10 }, '<=', 1.812)
    expect(r1.queryResult).toBeCloseTo(0.95, 2)
  })

  it('Hypergeometric mean/variance match combinatorial formula', () => {
    const r = computeLocalDistribution('Hypergeometric', { N: 50, K: 20, n: 10 }, '<=', 4)
    expect(r.theorMean).toBeCloseTo(4, 6)
    expect(r.theorVariance).toBeCloseTo(1.959184, 5)
    const sum = (r.probs ?? []).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 3)
  })
})

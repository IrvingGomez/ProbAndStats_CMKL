import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  clearWeightsIfUnused,
  configForDataset,
  heavyOf,
  isDirty,
  mergeForLive,
  overlaysNeedingRun,
  supportedOverlays,
  toParams,
  type GraphicalConfig,
} from './graphicalState'

const base = (over: Partial<GraphicalConfig> = {}): GraphicalConfig => ({
  column: 'Age',
  ...DEFAULT_CONFIG,
  ...over,
})

describe('mergeForLive', () => {
  it('drops every overlay until something has been run', () => {
    const cfg = base({ addNormal: true, addCi: true, addPi: true })
    const live = mergeForLive(cfg, null)
    expect(live.addNormal).toBe(false)
    expect(live.addCi).toBe(false)
    expect(live.addPi).toBe(false)
  })

  it('keeps the cheap settings the user is currently editing', () => {
    const committed = heavyOf(base({ addNormal: true }))
    const cfg = base({ addKde: false, bins: 12, graphType: 'ECDF', addNormal: true })
    const live = mergeForLive(cfg, committed)
    expect(live.addKde).toBe(false)
    expect(live.bins).toBe(12)
    expect(live.graphType).toBe('ECDF')
  })

  it('replays committed overlays rather than the uncommitted ones', () => {
    const committed = heavyOf(base({ addNormal: true, addCi: false }))
    // The user has since ticked CI but not pressed Run.
    const cfg = base({ addNormal: true, addCi: true })
    const live = mergeForLive(cfg, committed)
    expect(live.addNormal).toBe(true)
    expect(live.addCi).toBe(false)
  })

  it('never starts a bootstrap from a display toggle', () => {
    const committed = heavyOf(base({ addCi: true, bootstrapMean: true, bootstrapSamples: 5000 }))
    const live = mergeForLive(base({ addKde: false }), committed)
    expect(live.bootstrapMean).toBe(false)
    expect(live.bootstrapMedian).toBe(false)
    expect(live.bootstrapPi).toBe(false)
  })

  it('drops a bootstrap CI instead of substituting the analytic one', () => {
    // Silently swapping estimators would change the number under the same label.
    const committed = heavyOf(base({ addCi: true, bootstrapMean: true }))
    expect(mergeForLive(base(), committed).addCi).toBe(false)
  })

  it('keeps an analytic CI live, since it is cheap and unchanged', () => {
    const committed = heavyOf(base({ addCi: true, bootstrapMean: false }))
    expect(mergeForLive(base(), committed).addCi).toBe(true)
  })

  it('drops a bootstrap PI but keeps an analytic one', () => {
    const boot = heavyOf(base({ addPi: true, piChoice: 'Bootstrap', bootstrapPi: true }))
    expect(mergeForLive(base(), boot).addPi).toBe(false)

    const analytic = heavyOf(base({ addPi: true, piChoice: 'IQR' }))
    expect(mergeForLive(base(), analytic).addPi).toBe(true)
  })
})

describe('overlaysNeedingRun', () => {
  it('reports nothing before the first run', () => {
    expect(overlaysNeedingRun(null)).toEqual([])
  })

  it('reports nothing when no bootstrap is involved', () => {
    expect(overlaysNeedingRun(heavyOf(base({ addCi: true, addNormal: true })))).toEqual([])
  })

  it('names the bootstrap-backed overlays a live refresh cannot redraw', () => {
    const committed = heavyOf(base({
      addCi: true, bootstrapMedian: true,
      addPi: true, piChoice: 'Bootstrap', bootstrapPi: true,
    }))
    expect(overlaysNeedingRun(committed)).toEqual([
      'Confidence interval (bootstrap)',
      'Prediction interval (bootstrap)',
    ])
  })
})

describe('isDirty', () => {
  it('is clean on a fresh config with no overlays requested', () => {
    expect(isDirty(base(), null)).toBe(false)
  })

  it('is dirty when an overlay is requested but never run', () => {
    expect(isDirty(base({ addCi: true }), null)).toBe(true)
  })

  it('is clean immediately after a run', () => {
    const cfg = base({ addNormal: true, addCi: true, bootstrapMean: true })
    expect(isDirty(cfg, heavyOf(cfg))).toBe(false)
  })

  it('ignores cheap edits — those refresh on their own', () => {
    const cfg = base({ addNormal: true })
    const committed = heavyOf(cfg)
    const edited = { ...cfg, addKde: false, bins: 30, graphType: 'ECDF' as const }
    expect(isDirty(edited, committed)).toBe(false)
  })

  it.each([
    ['estimator', { meanEstimator: 'Interquartile Mean' }],
    ['confidence level', { confLevel: 0.99 }],
    ['bootstrap sample count', { bootstrapSamples: 2000 }],
    ['CI choice', { ciChoice: 'Mean' as const }],
  ])('is dirty after changing the %s', (_label, over) => {
    const cfg = base({ addCi: true })
    const committed = heavyOf(cfg)
    expect(isDirty({ ...cfg, ...over }, committed)).toBe(true)
  })
})

describe('configForDataset', () => {
  it('leaves a still-valid selection alone', () => {
    const cfg = base({ column: 'Age' })
    expect(configForDataset(cfg, ['Age', 'Height'])).toBe(cfg)
  })

  it('falls back to the first column when the old one is gone', () => {
    const next = configForDataset(base({ column: 'Age' }), ['Weight', 'Height'])
    expect(next.column).toBe('Weight')
  })

  it('picks a column when none was selected', () => {
    expect(configForDataset(base({ column: '' }), ['Weight']).column).toBe('Weight')
  })

  it('empties the column when the new dataset has no numeric columns', () => {
    expect(configForDataset(base({ column: 'Age' }), []).column).toBe('')
  })

  it('clears a weights column that the new dataset does not have', () => {
    const cfg = base({ column: 'Age', weightsColumn: 'OldWeight' })
    const next = configForDataset(cfg, ['Age', 'Height'])
    expect(next.column).toBe('Age')
    expect(next.weightsColumn).toBeNull()
  })
})

describe('clearWeightsIfUnused', () => {
  it('keeps the weights column for the weighted mean', () => {
    const cfg = base({ meanEstimator: 'Weighted Mean', weightsColumn: 'W' })
    expect(clearWeightsIfUnused(cfg).weightsColumn).toBe('W')
  })

  it('drops a stale weights column for every other estimator', () => {
    // Left in place it would reach the backend and shrink the sample.
    const cfg = base({ meanEstimator: 'Sample Mean', weightsColumn: 'W' })
    expect(clearWeightsIfUnused(cfg).weightsColumn).toBeNull()
  })

  it('is a no-op when there is nothing to clear', () => {
    const cfg = base()
    expect(clearWeightsIfUnused(cfg)).toBe(cfg)
  })
})

describe('supportedOverlays', () => {
  it('offers KDE and bins only on the histogram', () => {
    expect(supportedOverlays('Histogram')).toMatchObject({ kde: true, bins: true })
    expect(supportedOverlays('PMF')).toMatchObject({ kde: false, bins: false })
    expect(supportedOverlays('ECDF')).toMatchObject({ kde: false, bins: false })
  })

  it('refuses a density overlay on the probability axis of a PMF', () => {
    expect(supportedOverlays('PMF').normal).toBe(false)
    expect(supportedOverlays('Histogram').normal).toBe(true)
  })

  it('puts the confidence band on the ECDF and the interval strip elsewhere', () => {
    expect(supportedOverlays('ECDF')).toMatchObject({ confBand: true, intervals: false })
    expect(supportedOverlays('Histogram')).toMatchObject({ confBand: false, intervals: true })
  })
})

describe('toParams', () => {
  it('maps the config onto the wire shape', () => {
    const p = toParams(base({ column: 'Age', bins: 20, graphType: 'ECDF' }), {})
    expect(p).toMatchObject({
      column: 'Age',
      graph_type: 'ECDF',
      bins: 20,
      add_kde: true,
      bootstrap_samples: 1000,
    })
  })

  it('sends no filters key when nothing is filtered', () => {
    expect(toParams(base(), {}).filters).toBeNull()
  })

  it('forwards active filters so the plot matches the Data tab', () => {
    expect(toParams(base(), { City: ['Bangkok'] }).filters).toEqual({ City: ['Bangkok'] })
  })
})

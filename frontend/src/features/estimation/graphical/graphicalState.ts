// features/estimation/graphical/graphicalState.ts
// Pure state logic for the Graphical Analysis tab, kept free of React so the
// rules below (what refreshes live, what is stale, what a dataset swap resets)
// can be tested directly.

import type {
  CIChoice,
  GraphType,
  GraphicalParams,
  MuSource,
  PIChoice,
} from '../../../api/graphical'

export const DEBOUNCE_MS = 250

/** Bounds mirrored by the backend schema; DualInput clamps to these. */
export const BOUNDS = {
  bins: { min: 2, max: 200, step: 1 },
  confLevel: { min: 0.5, max: 0.999, step: 0.005 },
  trim: { min: 0.01, max: 0.49, step: 0.01 },
  bootstrapSamples: { min: 100, max: 5000, step: 100 },
} as const

export interface GraphicalConfig {
  column: string
  graphType: GraphType

  // Cheap — recomputed live
  bins: number | null
  addKde: boolean
  addData: boolean
  addConfBand: boolean
  ecdfConfLevel: number

  // Estimator-backed — applied on Run
  addNormal: boolean
  normalMuSource: MuSource
  addCi: boolean
  ciChoice: CIChoice
  addPi: boolean
  piChoice: PIChoice
  confLevel: number
  meanEstimator: string
  medianEstimator: string
  sigmaEstimator: string
  trimParam: number | null
  winsorLimits: string | null
  weightsColumn: string | null
  bootstrapMean: boolean
  bootstrapMedian: boolean
  bootstrapPi: boolean
  bootstrapSamples: number
}

export const DEFAULT_CONFIG: Omit<GraphicalConfig, 'column'> = {
  graphType: 'Histogram',
  bins: null,
  addKde: true,
  addData: false,
  addConfBand: true,
  ecdfConfLevel: 0.95,
  addNormal: false,
  normalMuSource: 'Mean-based CI',
  addCi: false,
  ciChoice: 'Both',
  addPi: false,
  piChoice: 'Mean',
  confLevel: 0.95,
  meanEstimator: 'Sample Mean',
  medianEstimator: 'Sample Median',
  sigmaEstimator: 'Deviation (1 ddof)',
  trimParam: null,
  winsorLimits: null,
  weightsColumn: null,
  bootstrapMean: false,
  bootstrapMedian: false,
  bootstrapPi: false,
  bootstrapSamples: 1000,
}

/** Settings that only take effect once Run is pressed. */
export const HEAVY_KEYS = [
  'addNormal', 'normalMuSource', 'addCi', 'ciChoice', 'addPi', 'piChoice',
  'confLevel', 'meanEstimator', 'medianEstimator', 'sigmaEstimator',
  'trimParam', 'winsorLimits', 'weightsColumn',
  'bootstrapMean', 'bootstrapMedian', 'bootstrapPi', 'bootstrapSamples',
] as const

export type HeavyConfig = Pick<GraphicalConfig, typeof HEAVY_KEYS[number]>

export function heavyOf(cfg: GraphicalConfig): HeavyConfig {
  const out = {} as HeavyConfig
  for (const k of HEAVY_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[k] = cfg[k]
  }
  return out
}

const NO_OVERLAYS: Pick<HeavyConfig, 'addNormal' | 'addCi' | 'addPi'> = {
  addNormal: false,
  addCi: false,
  addPi: false,
}

export function anyBootstrap(cfg: Pick<GraphicalConfig, 'bootstrapMean' | 'bootstrapMedian' | 'bootstrapPi'>): boolean {
  return cfg.bootstrapMean || cfg.bootstrapMedian || cfg.bootstrapPi
}

/**
 * Which committed overlays a live refresh cannot honestly redraw.
 *
 * A bootstrap interval is not just slow, it is a different estimator from its
 * analytic counterpart. Silently substituting the analytic one during a live
 * refresh would change the number under an unchanged label, so the affected
 * overlays are dropped and the caller reports them as stale instead.
 */
export function overlaysNeedingRun(committed: HeavyConfig | null): string[] {
  if (!committed) return []
  const dropped: string[] = []
  if (committed.addCi && (committed.bootstrapMean || committed.bootstrapMedian)) {
    dropped.push('Confidence interval (bootstrap)')
  }
  if (committed.addPi && committed.bootstrapPi && committed.piChoice === 'Bootstrap') {
    dropped.push('Prediction interval (bootstrap)')
  }
  return dropped
}

/**
 * Config for the debounced live path: the user's current cheap settings, plus
 * the overlays as of the last Run — never the uncommitted ones, and never a
 * bootstrap.
 */
export function mergeForLive(cfg: GraphicalConfig, committed: HeavyConfig | null): GraphicalConfig {
  if (!committed) return { ...cfg, ...NO_OVERLAYS }

  const merged: GraphicalConfig = { ...cfg, ...committed }

  if (committed.addCi && (committed.bootstrapMean || committed.bootstrapMedian)) {
    merged.addCi = false
  }
  if (committed.addPi && committed.bootstrapPi && committed.piChoice === 'Bootstrap') {
    merged.addPi = false
  }
  // Never start a resampling run from a display toggle.
  merged.bootstrapMean = false
  merged.bootstrapMedian = false
  merged.bootstrapPi = false

  return merged
}

/** True when overlay settings have been changed but not yet applied with Run. */
export function isDirty(cfg: GraphicalConfig, committed: HeavyConfig | null): boolean {
  const current = heavyOf(cfg)
  if (!committed) {
    // Nothing committed yet: only an actually-requested overlay counts as dirty.
    return current.addNormal || current.addCi || current.addPi
  }
  return HEAVY_KEYS.some((k) => current[k] !== committed[k])
}

/**
 * Reconcile the config with a (possibly new) dataset.
 *
 * A column from the previous file must not survive a new upload; when the
 * current selection is gone, fall back to the first numeric column and clear
 * the weights column, which is dataset-specific too.
 */
export function configForDataset(cfg: GraphicalConfig, numericCols: string[]): GraphicalConfig {
  const columnOk = !!cfg.column && numericCols.includes(cfg.column)
  const weightsOk = !cfg.weightsColumn || numericCols.includes(cfg.weightsColumn)
  if (columnOk && weightsOk) return cfg

  return {
    ...cfg,
    column: columnOk ? cfg.column : (numericCols[0] ?? ''),
    weightsColumn: weightsOk ? cfg.weightsColumn : null,
  }
}

/**
 * A weights column only feeds the weighted mean. Clearing it on the way out
 * keeps a stale selection from reaching the backend, where aligning on it would
 * shrink the sample.
 */
export function clearWeightsIfUnused(cfg: GraphicalConfig): GraphicalConfig {
  if (cfg.meanEstimator === 'Weighted Mean' || cfg.weightsColumn === null) return cfg
  return { ...cfg, weightsColumn: null }
}

/** Overlays the backend will refuse for this graph type, so the UI can hide them. */
export function supportedOverlays(graphType: GraphType) {
  return {
    kde: graphType === 'Histogram',
    rug: graphType !== 'ECDF',
    // A density on a probability axis is not comparable; the PMF refuses it.
    normal: graphType !== 'PMF',
    intervals: graphType !== 'ECDF',
    confBand: graphType === 'ECDF',
    bins: graphType === 'Histogram',
  }
}

export function toParams(
  cfg: GraphicalConfig,
  filters: Record<string, string[]>
): GraphicalParams {
  return {
    column: cfg.column,
    graph_type: cfg.graphType,
    bins: cfg.bins,
    add_kde: cfg.addKde,
    add_data: cfg.addData,
    add_normal: cfg.addNormal,
    normal_mu_source: cfg.normalMuSource,
    add_ci: cfg.addCi,
    ci_choice: cfg.ciChoice,
    add_pi: cfg.addPi,
    pi_choice: cfg.piChoice,
    conf_level: cfg.confLevel,
    add_conf_band: cfg.addConfBand,
    ecdf_conf_level: cfg.ecdfConfLevel,
    mean_estimator: cfg.meanEstimator,
    median_estimator: cfg.medianEstimator,
    sigma_estimator: cfg.sigmaEstimator,
    trim_param: cfg.trimParam,
    winsor_limits: cfg.winsorLimits,
    weights_column: cfg.weightsColumn,
    bootstrap_mean: cfg.bootstrapMean,
    bootstrap_median: cfg.bootstrapMedian,
    bootstrap_pi: cfg.bootstrapPi,
    bootstrap_samples: cfg.bootstrapSamples,
    filters: Object.keys(filters).length > 0 ? filters : null,
  }
}

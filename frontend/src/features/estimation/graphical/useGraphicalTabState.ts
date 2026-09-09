import { useCallback, useEffect, useRef, useState } from 'react'
import { useData } from '../../../context/DataContext'
import { graphicalApi, type GraphType, type GraphicalResponse } from '../../../api/graphical'
import {
  DEBOUNCE_MS,
  heavyOf,
  isDirty as computeDirty,
  mergeForLive,
  overlaysNeedingRun,
  toParams,
  type GraphicalConfig,
  type HeavyConfig,
} from './graphicalState'

export type { GraphicalConfig } from './graphicalState'
export { DEFAULT_CONFIG } from './graphicalState'

/**
 * Two request paths against one endpoint: cheap display toggles refresh live
 * (debounced, previous request aborted), while estimator- and bootstrap-backed
 * overlays wait for an explicit Run — a bootstrap can be 5000 resamples.
 *
 * The rules for which is which live in `graphicalState.ts` so they can be
 * tested without rendering.
 */
export function useGraphicalTabState() {
  const { state: dataState } = useData()

  const [result, setResult] = useState<GraphicalResponse | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Echoed back so the Observation and Notebook panels label themselves with
  // the request the current result actually came from.
  const [active, setActive] = useState<{ column: string; graphType: GraphType }>({
    column: '',
    graphType: 'Histogram',
  })

  // Overlay settings as of the last Run.
  const [committed, setCommitted] = useState<HeavyConfig | null>(null)
  const committedRef = useRef<HeavyConfig | null>(null)
  const latestCfgRef = useRef<GraphicalConfig | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sessionId = dataState.sessionId
  const filters = dataState.filters

  // Whether the displayed result came from an explicit Run. A live refresh
  // cannot redraw a bootstrap, so only then are those overlays stale.
  const [resultViaRun, setResultViaRun] = useState(false)

  const fire = useCallback(
    (cfg: GraphicalConfig, viaRun: boolean) => {
      if (!sessionId) {
        setError('No active session. Please upload a dataset first.')
        return
      }
      if (!cfg.column) {
        setResult(null)
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsComputing(true)
      setError(null)

      graphicalApi
        .computeGraph(sessionId, toParams(cfg, filters), controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return
          setResult(data)
          setResultViaRun(viaRun)
          setActive({ column: cfg.column, graphType: cfg.graphType })
          setIsComputing(false)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : String(err))
          setIsComputing(false)
        })
    },
    [sessionId, filters]
  )

  /** Debounced path for display-only changes. */
  const applyLive = useCallback(
    (cfg: GraphicalConfig) => {
      latestCfgRef.current = cfg
      setIsDirty(computeDirty(cfg, committedRef.current))
      if (timerRef.current) clearTimeout(timerRef.current)
      const merged = mergeForLive(cfg, committedRef.current)
      timerRef.current = setTimeout(() => fire(merged, false), DEBOUNCE_MS)
    },
    [fire]
  )

  /** Immediate path: commits the overlay settings, then computes. */
  const run = useCallback(
    (cfg: GraphicalConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const heavy = heavyOf(cfg)
      committedRef.current = heavy
      latestCfgRef.current = cfg
      setCommitted(heavy)
      setIsDirty(false)
      fire(cfg, true)
    },
    [fire]
  )

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
    committedRef.current = null
    latestCfgRef.current = null
    setCommitted(null)
    setIsDirty(false)
    setResult(null)
    setResultViaRun(false)
    setError(null)
    setIsComputing(false)
  }, [])

  // A filter change on the Data tab alters the sample, so the plot has to be
  // recomputed — otherwise it silently disagrees with every other tab.
  // Re-running is not enough on its own: a committed bootstrap is dropped by
  // mergeForLive, which the stale banner then reports.
  const filtersKey = JSON.stringify(filters)
  const firstFilterPass = useRef(true)
  useEffect(() => {
    if (firstFilterPass.current) {
      firstFilterPass.current = false
      return
    }
    const cfg = latestCfgRef.current
    if (!cfg) return
    if (timerRef.current) clearTimeout(timerRef.current)
    fire(mergeForLive(cfg, committedRef.current), false)
    setIsDirty(computeDirty(cfg, committedRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  // A new upload invalidates everything computed against the old one.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
    committedRef.current = null
    latestCfgRef.current = null
    setCommitted(null)
    setIsDirty(false)
    setResult(null)
    setResultViaRun(false)
    setError(null)
    setIsComputing(false)
  }, [sessionId])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
  }, [])

  // Overlays the last Run produced that the displayed result no longer carries,
  // because a live refresh cannot redraw a bootstrap.
  const staleOverlays = result && !resultViaRun ? overlaysNeedingRun(committed) : []

  return {
    result,
    column: active.column,
    graphType: active.graphType,
    isComputing,
    error,
    isDirty,
    staleOverlays,
    applyLive,
    run,
    reset,
    hasData: dataState.status === 'ready' && dataState.numericCols.length > 0,
    numericCols: dataState.numericCols,
    precision: dataState.displayPrecision,
    sessionId,
  }
}

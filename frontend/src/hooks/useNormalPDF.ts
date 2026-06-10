import { useState, useEffect, useRef } from 'react'
import { computeNormalPDF } from '../api/probability'
import type { NormalPDFResponse } from '../api/probability'

export interface NormalPDFParams {
  mean: number
  std: number
  n: number
  alpha: number
}

export type NormalPDFResult = NormalPDFResponse

const DEBOUNCE_MS = 250

export function useNormalPDF(
  params: NormalPDFParams | null,
): {
  result: NormalPDFResult | null
  isLoading: boolean
  error: string | null
} {
  const [result, setResult] = useState<NormalPDFResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!params) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      setError(null)

      computeNormalPDF(params, controller.signal)
        .then((data) => {
          setResult(data)
          setIsLoading(false)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : String(err))
          setIsLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.mean, params?.std, params?.n, params?.alpha])

  return { result, isLoading, error }
}

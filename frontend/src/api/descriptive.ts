export interface StatRow {
  category: 'Quantiles' | 'Central Tendency' | 'Dispersion' | 'Shape' | 'Extremes'
  measure: string
  value: number | null
  consistencyCorr: number | null
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
    whiskerLo: number; q1: number; median: number; q3: number; whiskerHi: number
    outliers: number[]
  }
}

export interface DescriptiveInput {
  sessionId: string
  column: string
  quantileProbs: number[]
  trimAlpha: number | null
  winsorLimits: [number, number] | null
  weightsCol: string | null
  filters: Record<string, string[]> | null
}

export async function computeDescriptiveStats(input: DescriptiveInput): Promise<DescriptiveResult> {
  const res = await fetch('/api/descriptive/compute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': input.sessionId
    },
    body: JSON.stringify({
      session_id: input.sessionId,
      column: input.column,
      quantileProbs: input.quantileProbs,
      trimAlpha: input.trimAlpha,
      winsorLimits: input.winsorLimits,
      weightsCol: input.weightsCol,
      filters: input.filters
    })
  })

  if (!res.ok) {
    const text = await res.text()
    let errStr = text
    try {
      const errObj = JSON.parse(text)
      errStr = errObj.detail || text
    } catch {
      if (!text) errStr = `Backend proxy error: status ${res.status}`
    }
    throw new Error(errStr)
  }

  return res.json()
}

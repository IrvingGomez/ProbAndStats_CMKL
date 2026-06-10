export interface DistributionRequest {
  distName: string
  params: Record<string, number>
  queryOp: string
  queryK: number
}

export interface NormalPDFRequest {
  mean: number
  std: number
  n: number
  alpha: number
}

export interface NormalPDFResponse {
  xValues: number[]
  yValues: number[]
  cdfValues: number[]
  ciLow: number
  ciHigh: number
  shadeX: number[]
  shadeY: number[]
  se: number
  zCritical: number
}

export async function computeNormalPDF(
  req: NormalPDFRequest,
  signal?: AbortSignal,
): Promise<NormalPDFResponse> {
  const res = await fetch('/api/probability/normal-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).detail ?? text } catch { /* empty */ }
    throw new Error(msg)
  }
  return res.json()
}

export interface DistributionResponse {
  // discrete
  ks?: number[]
  probs?: number[]
  cumProbs?: number[]
  // continuous
  xs?: number[]
  ys?: number[]
  cdfYs?: number[]
  // shared
  queryResult: number
  theorMean: number | string
  theorVariance: number | string
}

export async function computeDistribution(
  req: DistributionRequest,
  signal?: AbortSignal,
): Promise<DistributionResponse> {
  const res = await fetch('/api/probability/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).detail ?? text } catch { /* empty */ }
    throw new Error(msg)
  }
  return res.json()
}

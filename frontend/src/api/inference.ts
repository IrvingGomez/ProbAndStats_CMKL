const BASE_URL = "/api/inference";

export interface EstimatorRequest {
  session_id: string;
  column: string;
}

export interface EstimatorOptions {
  mean_estimators: string[];
  deviation_estimators: string[];
}

export interface InferenceParams {
  session_id: string;
  column: string;
  alpha: number;
  mean_estimator: string;
  median_estimator: string;
  sigma_estimator: string;
  trim_param?: number | null;
  winsor_limits?: string | null;
  weights_column?: string | null;
  bootstrap_mean: boolean;
  bootstrap_median: boolean;
  bootstrap_deviation: boolean;
  bootstrap_pi: boolean;
  bootstrap_samples: number;
  filters?: Record<string, string[]> | null;
}

export interface ConfidenceRegionsParams extends InferenceParams {
  probs: number[];
  eps_mu: number[];
  eps_sigma: number[];
  add_ci_box: boolean;
  mu_ci_source: string;
}

export interface IntervalsResponse {
  table: string; // JSON string; each record also carries a `Method` field
  n: number;
  point_estimates: { mean: number; median: number; deviation: number };
  histogram: { binEdges: number[]; counts: number[] };
}

export interface ConfidenceRegionsResponse {
  z_matrix: number[][];
  mu_grid: number[];
  sigma_grid: number[];
  mu_hat: number;
  sigma_hat: number;
  mu_ci: number[];
  sigma_ci: number[];
  probs: number[];
  levels: number[];
  table?: string;
}

export const inferenceApi = {
  getEstimators: async (req: EstimatorRequest): Promise<EstimatorOptions> => {
    const response = await fetch(`${BASE_URL}/estimators`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-session-id": req.session_id
      },
      body: JSON.stringify(req),
    });
    if (!response.ok) {
      const text = await response.text();
      let errStr = text;
      try { errStr = JSON.parse(text).detail || text; } catch {}
      throw new Error(errStr);
    }
    return response.json();
  },

  computeCI: async (params: InferenceParams): Promise<IntervalsResponse> => {
    const response = await fetch(`${BASE_URL}/ci`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-session-id": params.session_id
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const text = await response.text();
      let errStr = text;
      try { errStr = JSON.parse(text).detail || text; } catch {}
      throw new Error(errStr);
    }
    return response.json();
  },

  computePI: async (params: InferenceParams): Promise<IntervalsResponse> => {
    const response = await fetch(`${BASE_URL}/pi`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-session-id": params.session_id
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const text = await response.text();
      let errStr = text;
      try { errStr = JSON.parse(text).detail || text; } catch {}
      throw new Error(errStr);
    }
    return response.json();
  },

  computeRegions: async (params: ConfidenceRegionsParams): Promise<ConfidenceRegionsResponse> => {
    const response = await fetch(`${BASE_URL}/regions`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-session-id": params.session_id
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const text = await response.text();
      let errStr = text;
      try { errStr = JSON.parse(text).detail || text; } catch {}
      throw new Error(errStr);
    }
    return response.json();
  },
};

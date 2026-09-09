const BASE_URL = "/api/graphical";

export type GraphType = "Histogram" | "PMF" | "ECDF";
export type CIChoice = "Mean" | "Median" | "Both";
export type PIChoice = "Mean" | "Median" | "IQR" | "Bootstrap";
export type MuSource = "Mean-based CI" | "Median-based CI";

export interface GraphicalParams {
  column: string;
  graph_type: GraphType;

  // Histogram / PMF display
  bins?: number | null;
  add_kde: boolean;
  add_data: boolean;

  // Overlays
  add_normal: boolean;
  normal_mu_source?: MuSource;
  add_ci?: boolean;
  ci_choice?: CIChoice;
  add_pi?: boolean;
  pi_choice?: PIChoice;
  conf_level?: number;

  // ECDF
  add_conf_band?: boolean;
  ecdf_conf_level?: number;

  // Estimators
  mean_estimator?: string;
  median_estimator?: string;
  sigma_estimator?: string;
  trim_param?: number | null;
  winsor_limits?: string | null;
  weights_column?: string | null;

  // Bootstrap
  bootstrap_mean?: boolean;
  bootstrap_median?: boolean;
  bootstrap_pi?: boolean;
  bootstrap_samples?: number;

  filters?: Record<string, string[]> | null;
}

export interface IntervalBand {
  label: string;
  kind: "ci_mean" | "ci_median" | "pi";
  low: number;
  high: number;
  center: number;
}

export interface GraphicalResponse {
  summary: { n: number; n_unique: number };
  histogram_data?: { bins: number[]; counts: number[]; densities: number[] } | null;
  pmf_data?: { values: number[]; probs: number[] } | null;
  ecdf_data?: {
    x: number[];
    y: number[];
    epsilon: number;
    lower?: number[] | null;
    upper?: number[] | null;
  } | null;
  kde_curve?: { x: number[]; y: number[] } | null;
  normal_curve?: { x: number[]; y: number[]; mu: number; sigma: number } | null;
  rug_data?: { x: number[]; n_shown: number; n_total: number } | null;
  interval_bands?: IntervalBand[] | null;
  point_estimates?: { mu: number | null; sigma: number | null } | null;
  dist_used?: string | null;
  alpha?: number | null;
  warnings: string[];
}

export const graphicalApi = {
  computeGraph: async (
    sessionId: string,
    params: GraphicalParams,
    signal?: AbortSignal
  ): Promise<GraphicalResponse> => {
    const response = await fetch(`${BASE_URL}/compute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId
      },
      body: JSON.stringify(params),
      signal,
    });
    if (!response.ok) {
      const text = await response.text();
      let errStr = text;
      try { errStr = JSON.parse(text).detail || text; } catch {}
      throw new Error(errStr);
    }
    return response.json();
  }
};

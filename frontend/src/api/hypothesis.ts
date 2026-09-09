const BASE_URL = "/api/hypothesis";

export const ONE_SAMPLE_T = "One sample Student's t-test";
export const TWO_SAMPLE_T = "Two samples Student's t-test";
export const EQUAL_VARIANCE = "Equal variance between two groups";
export const ONE_WAY_ANOVA = "One-way ANOVA";

export const TEST_TYPES = [
  ONE_SAMPLE_T,
  TWO_SAMPLE_T,
  EQUAL_VARIANCE,
  ONE_WAY_ANOVA,
] as const;

export type TestType = (typeof TEST_TYPES)[number];
export type Alternative = "two-sided" | "greater" | "less";

export interface GroupSpec {
  column: string;
  values: string[];
  name: string;
}

export interface HypothesisParams {
  session_id: string;
  column: string;
  test_type: string;
  alpha: number;
  alternative: Alternative;
  mu0?: number | null;
  correction: boolean;
  variance_test_type: string;
  group1?: GroupSpec | null;
  group2?: GroupSpec | null;
  anova_column?: string | null;
  anova_levels?: string[] | null;
  filters?: Record<string, string[]> | null;
}

export interface RejectionRegionData {
  dist: "t" | "chi2" | "f";
  dof: number[];
  x: number[];
  pdf: number[];
  /** Ceiling for the y axis: crops the spike a one-degree-of-freedom density has near zero. */
  y_max: number;
  /** Axis domain: sized to the null distribution, not to an extreme statistic. */
  x_range: [number, number];
  statistic: number;
  /** True when the statistic lies past `x_range` and its marker must be pinned to the edge. */
  statistic_offscale: boolean;
  critical_values: number[];
  /** Shaded because of α. */
  reject_region: number[][];
  /** Shaded because of the observed statistic. */
  p_area: number[][];
  tail: Alternative;
  reject: boolean;
}

export interface GroupSummary {
  name: string;
  n: number;
  mean: number;
  sd: number;
  var: number;
}

export interface HypothesisResponse {
  test_type: string;
  /** JSON string of the raw library result table; columns differ per test. */
  table: string;
  statistic: number;
  p_value: number;
  alpha: number;
  reject: boolean;
  verdict: string;
  h0: string;
  h1: string;
  rejection_region: RejectionRegionData;
  group_summary?: GroupSummary[] | null;
  warnings: string[];
}

export const hypothesisApi = {
  runTest: async (params: HypothesisParams): Promise<HypothesisResponse> => {
    const response = await fetch(`${BASE_URL}/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": params.session_id,
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

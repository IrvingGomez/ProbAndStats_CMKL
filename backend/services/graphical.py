"""Orchestration for the Graphical Analysis tab.

Validates, resolves estimators, reuses the shared interval computation from
``services.inference``, then delegates the drawing data to
``core.estimation.graphical_json``. No numpy / scipy / statsmodels imports here —
this layer only validates, delegates and maps schemas.
"""

from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from api.schemas.graphical import GraphicalParams
from api.schemas.inference import InferenceParams
from core.estimation import graphical_json as gj
from core.estimation.graphical_json import DegenerateDataError
from core.estimation.inference.estimators import (
    estimate_mean,
    estimate_median,
    estimate_sigma,
)
from services.inference import calculate_intervals, select_distribution

# Labels drawn on the interval strip, mirroring the matplotlib overlay.
_CI_MEAN_LABEL = "CI Mean"
_CI_MEDIAN_LABEL = "CI Median"
_PI_LABEL = "Prediction Interval"

# The only estimator that consumes a weights column. Any other selection must
# ignore it - otherwise aligning on the weights column silently drops rows.
_WEIGHTED_MEAN = "Weighted Mean"


def validate_deviation_estimator(*, sigma_estimator: str, n: int) -> None:
    if sigma_estimator == "Range (bias corrected)" and n > 25:
        raise ValueError(
            "Range-based confidence intervals require n ≤ 25. "
            "Use another estimator or bootstrap."
        )


def resolve_weights_column(params: GraphicalParams) -> Optional[str]:
    """
    A weights column is only meaningful for the weighted mean.

    Leaving a stale selection in place is not harmless: ``prepare_series``
    intersects the two columns' indices, so a weights column with missing values
    would quietly shrink the sample for every statistic on the plot.
    """
    if params.mean_estimator != _WEIGHTED_MEAN:
        return None
    return params.weights_column


def prepare_series(
    df: pd.DataFrame,
    column: str,
    weights_col: Optional[str],
) -> Tuple[pd.Series, Optional[pd.Series]]:
    """Drop missing values and align an optional weights column on the same index."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found in the dataframe.")

    series = df[column].dropna()
    if series.empty:
        raise ValueError(f"Column '{column}' has no non-missing values.")

    weights = None
    if weights_col:
        if weights_col not in df.columns:
            raise ValueError(f"Weights column '{weights_col}' not found in the dataframe.")
        weights_series = df[weights_col].reindex(series.index).dropna()
        common_idx = series.index.intersection(weights_series.index)
        if len(common_idx) == 0:
            raise ValueError(
                f"No rows have both '{column}' and weights '{weights_col}' present."
            )
        series = series.loc[common_idx]
        weights = weights_series.loc[common_idx]

    return series, weights


def _as_inference_params(params: GraphicalParams, alpha: float) -> InferenceParams:
    """Reuse the inference request shape so ``calculate_intervals`` can be shared."""
    return InferenceParams(
        session_id="graphical",  # unused by calculate_intervals
        column=params.column,
        alpha=alpha,
        mean_estimator=params.mean_estimator,
        median_estimator=params.median_estimator,
        sigma_estimator=params.sigma_estimator,
        trim_param=params.trim_param,
        winsor_limits=params.winsor_limits,
        weights_column=params.weights_column,
        bootstrap_mean=params.bootstrap_mean,
        bootstrap_median=params.bootstrap_median,
        bootstrap_deviation=False,
        bootstrap_pi=params.bootstrap_pi,
        bootstrap_samples=params.bootstrap_samples,
    )


def _pi_row(pi_table: pd.DataFrame, pi_choice: str):
    rows = pi_table[pi_table["Statistic"] == pi_choice]
    if rows.empty:
        if pi_choice == "Bootstrap":
            raise ValueError(
                "To use the Bootstrap prediction interval, enable the "
                "'Bootstrap Prediction' option in the estimator settings."
            )
        raise ValueError(f"Unknown prediction-interval choice: {pi_choice}")
    row = rows.iloc[0]
    return (row["Lower"], row["Upper"])


def compute_graphical_data(df: pd.DataFrame, params: GraphicalParams) -> Dict[str, Any]:
    is_ecdf = params.graph_type == "ECDF"
    is_pmf = params.graph_type == "PMF"

    conf_level = params.ecdf_conf_level if is_ecdf else params.conf_level
    if not (0.0 < conf_level < 1.0):
        raise ValueError("Confidence level must be in (0, 1).")
    alpha = 1.0 - conf_level

    weights_col = resolve_weights_column(params)
    data, weights = prepare_series(df, params.column, weights_col)
    n = len(data)
    values = data.to_numpy()

    warnings: List[str] = []
    if params.weights_column and weights_col is None:
        warnings.append(
            f"Weights column '{params.weights_column}' was ignored: it only applies to the "
            "weighted mean."
        )

    # An empirical PMF plots probabilities, which sum to 1; a KDE and a normal
    # curve are densities, which integrate to 1. Drawing one on the other's axis
    # invites a comparison that is not true, so the overlays are refused here
    # rather than silently rescaled.
    add_kde = params.add_kde and not is_ecdf and not is_pmf
    add_normal = params.add_normal and not is_pmf
    if is_pmf and (params.add_kde or params.add_normal):
        warnings.append(
            "Density overlays are not drawn on an empirical PMF: the PMF axis is probability, "
            "not density. Switch to the histogram to compare against a density."
        )
    if is_ecdf and params.add_kde:
        warnings.append("KDE is not drawn on the ECDF; use the Normal CDF overlay instead.")

    # ECDF has no rug or interval strip; its overlay is the Normal CDF.
    add_data = params.add_data and not is_ecdf
    add_ci = params.add_ci and not is_ecdf
    add_pi = params.add_pi and not is_ecdf

    hat_mu: Optional[float] = None
    hat_sigma: Optional[float] = None
    interval_specs: List[Tuple[str, str, Any]] = []
    dist_used: Optional[str] = None

    if add_normal or add_ci or add_pi:
        validate_deviation_estimator(sigma_estimator=params.sigma_estimator, n=n)

    if add_normal:
        if params.normal_mu_source == "Mean-based CI":
            hat_mu = float(
                estimate_mean(
                    data,
                    params.mean_estimator,
                    trim_param=params.trim_param,
                    winsor_limits=params.winsor_limits,
                    weights=weights,
                )
            )
        else:
            hat_mu = float(estimate_median(data, params.median_estimator))
        hat_sigma = float(estimate_sigma(data, params.sigma_estimator))

    if add_ci or add_pi:
        inf_params = _as_inference_params(params, alpha)
        dist_used = select_distribution(params.mean_estimator, params.sigma_estimator)
        _, pi_table, mean_ci, _, median_ci, _ = calculate_intervals(data, inf_params, weights)

        if add_ci:
            if params.ci_choice in ("Mean", "Both"):
                interval_specs.append((_CI_MEAN_LABEL, "ci_mean", mean_ci))
            if params.ci_choice in ("Median", "Both"):
                interval_specs.append((_CI_MEDIAN_LABEL, "ci_median", median_ci))
        if add_pi:
            interval_specs.append(
                (f"{_PI_LABEL} ({params.pi_choice})", "pi", _pi_row(pi_table, params.pi_choice))
            )

    if is_pmf:
        n_unique = int(data.nunique())
        if n_unique > 0.5 * n:
            warnings.append(
                f"The empirical PMF assumes a discrete variable, but '{params.column}' has "
                f"{n_unique} unique values in {n} observations. A histogram or the ECDF "
                "will read better here."
            )

    # -- Assemble the drawing data --------------------------------------------
    response: Dict[str, Any] = {"summary": gj.compute_summary(values)}

    if params.graph_type == "Histogram":
        response["histogram_data"] = gj.compute_histogram_data(values, bins=params.bins)
    elif is_pmf:
        response["pmf_data"] = gj.compute_pmf_data(values)
    elif is_ecdf:
        response["ecdf_data"] = gj.compute_ecdf_data(
            values, alpha=alpha, add_conf_band=params.add_conf_band
        )
    else:  # pragma: no cover - the schema's Literal already excludes this
        raise ValueError(f"Unknown graph type: {params.graph_type}")

    # A degenerate sample makes a density meaningless rather than wrong; say so
    # and keep the rest of the plot instead of failing the whole request.
    if add_kde:
        try:
            response["kde_curve"] = gj.compute_kde_data(values)
        except DegenerateDataError as e:
            warnings.append(f"KDE not drawn: {e}")

    if add_data:
        response["rug_data"] = gj.compute_rug_data(values)

    if add_normal:
        try:
            response["normal_curve"] = gj.compute_normal_density_data(
                values, is_cdf=is_ecdf, hat_mu=hat_mu, hat_sigma=hat_sigma
            )
        except DegenerateDataError as e:
            warnings.append(f"Normal overlay not drawn: {e}")

    if interval_specs:
        bands, dropped = gj.compute_interval_bands(interval_specs)
        if bands:
            response["interval_bands"] = bands
        for label in dropped:
            warnings.append(
                f"{label} could not be drawn: the interval is undefined for this sample "
                "(no variation in the data)."
            )

    response["point_estimates"] = {"mu": hat_mu, "sigma": hat_sigma}
    response["dist_used"] = dist_used
    response["alpha"] = alpha
    response["warnings"] = warnings
    return response

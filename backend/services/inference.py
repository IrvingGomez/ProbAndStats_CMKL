import pandas as pd
import json

from api.schemas.inference import InferenceParams, ConfidenceRegionsParams

from core.estimation.inference.ci import (
    ci_mean_analytic,
    ci_median_analytic,
    ci_deviation_analytic,
    ci_mean_bootstrap,
    ci_median_bootstrap,
    ci_deviation_bootstrap,
)

from core.estimation.inference.pi import (
    pi_mean,
    pi_median,
    pi_iqr,
    pi_bootstrap,
)

from core.estimation.inference.estimator_options import available_estimators
from core.estimation.inference.confidence_regions import compute_confidence_regions_data
from core.estimation.inference.estimators import estimate_mean, estimate_median, estimate_sigma
from core.estimation.descriptive import compute_histogram

def select_distribution(mean_estimator: str, sigma_estimator: str) -> str:
    if mean_estimator == "Sample Mean" and sigma_estimator == "Deviation (1 ddof)":
        return "t"
    return "norm"

def get_estimators(data: pd.Series):
    mean_choices, deviation_choices = available_estimators(data)
    return {
        "mean_estimators": mean_choices,
        "deviation_estimators": deviation_choices,
    }

def calculate_intervals(data: pd.Series, params: InferenceParams, weights: pd.Series = None):
    n = len(data)
    dist = select_distribution(params.mean_estimator, params.sigma_estimator)
    
    # Parse winsor limits if string
    winsor_limits = None
    if params.winsor_limits:
        try:
            parts = [float(p.strip()) for p in params.winsor_limits.split(",") if p.strip()]
            if len(parts) == 2:
                winsor_limits = (parts[0], parts[1])
        except Exception:
            pass

    # CI Computation
    if params.bootstrap_mean:
        mean_ci = ci_mean_bootstrap(
            data=data, estimator=params.mean_estimator, alpha=params.alpha,
            B=params.bootstrap_samples, trim_param=params.trim_param,
            winsor_limits=winsor_limits, weights=weights
        )
    else:
        mean_ci = ci_mean_analytic(
            data=data, estimator=params.mean_estimator, alpha=params.alpha, dist=dist,
            sigma_estimator=params.sigma_estimator, trim_param=params.trim_param,
            winsor_limits=winsor_limits, weights=weights
        )

    if params.bootstrap_median:
        median_ci = ci_median_bootstrap(
            data=data, alpha=params.alpha, estimator=params.median_estimator, B=params.bootstrap_samples
        )
    else:
        median_ci = ci_median_analytic(
            data=data, alpha=params.alpha, estimator=params.median_estimator, sigma_estimator=params.sigma_estimator
        )

    if params.bootstrap_deviation:
        sigma_ci = ci_deviation_bootstrap(
            data=data, alpha=params.alpha, estimator=params.sigma_estimator, B=params.bootstrap_samples
        )
    else:
        sigma_ci = ci_deviation_analytic(
            data=data, alpha=params.alpha, estimator=params.sigma_estimator
        )

    # Method labels — derived where each branch is actually taken, so a bootstrap
    # run is labelled honestly rather than by the analytic `dist`.
    B = params.bootstrap_samples
    # "Deviation (1 ddof)" -> "s (ddof=1)"; the rest carry their own name
    sigma_name = (
        "s (ddof=1)" if params.sigma_estimator == "Deviation (1 ddof)"
        else params.sigma_estimator.split(" (")[0]
    )

    mean_method = (
        f"Bootstrap (B={B})" if params.bootstrap_mean
        else (f"t (df={n - 1})" if dist == "t" else f"Normal (z, {sigma_name})")
    )
    median_method = (
        f"Bootstrap (B={B})" if params.bootstrap_median
        else f"Normal (asymptotic, {sigma_name})"
    )
    if params.bootstrap_deviation:
        dev_method = f"Bootstrap (B={B})"
    elif params.sigma_estimator == "Deviation (1 ddof)":
        dev_method = "Chi-square (s, ddof=1)"
    else:
        dev_method = f"Normal (asymptotic, {sigma_name})"

    # PI Computation
    pi_rows = []
    pi_mean_method = f"t (df={n - 1})" if dist == "t" else f"Normal (z, {sigma_name})"

    mean_pi = pi_mean(
        data=data, alpha=params.alpha, estimator=params.mean_estimator, dist=dist,
        sigma_estimator=params.sigma_estimator, trim_param=params.trim_param,
        winsor_limits=winsor_limits, weights=weights
    )
    pi_rows.append(["Prediction", "Mean", *mean_pi, pi_mean_method])

    median_pi = pi_median(
        data=data, alpha=params.alpha, estimator=params.median_estimator,
        sigma_estimator=params.sigma_estimator
    )
    pi_rows.append(["Prediction", "Median", *median_pi, f"Normal (asymptotic, {sigma_name})"])

    iqr_pi = pi_iqr(data=data, alpha=params.alpha)
    pi_rows.append(["Prediction", "IQR", *iqr_pi, "IQR (normal-scaled)"])

    if params.bootstrap_pi:
        boot_pi = pi_bootstrap(data=data, alpha=params.alpha, B=params.bootstrap_samples)
        pi_rows.append(["Prediction", "Bootstrap", *boot_pi, f"Bootstrap quantiles (B={B})"])

    ci_table = pd.DataFrame([
        ["Confidence", "Mean", *mean_ci, mean_method],
        ["Confidence", "Median", *median_ci, median_method],
        ["Confidence", "Deviation", *sigma_ci, dev_method],
    ], columns=["Interval Type", "Statistic", "Lower", "Upper", "Method"])

    pi_table = pd.DataFrame(pi_rows, columns=["Interval Type", "Statistic", "Lower", "Upper", "Method"])

    context = {
        "n": int(n),
        "point_estimates": {
            "mean": float(estimate_mean(data, "Sample Mean")),
            "median": float(estimate_median(data, "Sample Median")),
            "deviation": float(estimate_sigma(data, params.sigma_estimator)),
        },
        "histogram": compute_histogram(data),
    }

    return ci_table, pi_table, mean_ci, sigma_ci, median_ci, context

def calculate_regions(data: pd.Series, params: ConfidenceRegionsParams, weights: pd.Series = None):
    ci_table, pi_table, mean_ci, sigma_ci, median_ci, _ = calculate_intervals(data, params, weights)
    mu_ci = median_ci if params.mu_ci_source == "Median-based CI" else mean_ci

    grid = compute_confidence_regions_data(
        data=data,
        mean_ci=mu_ci,
        sigma_ci=sigma_ci,
        probs=params.probs,
        eps_mu=params.eps_mu,
        eps_sigma=params.eps_sigma,
    )
    grid["mu_ci"] = [float(x) for x in mu_ci]
    grid["sigma_ci"] = [float(x) for x in sigma_ci]
    grid["table"] = ci_table.to_json(orient="records") if params.add_ci_box else None
    return grid

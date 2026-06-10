# ui/stats/estimation/descriptive.py

from functools import lru_cache
import numpy as np
import pandas as pd
from scipy.stats import (
    trim_mean,
    gmean,
    hmean,
    skew,
    kurtosis,
    norm
)
from scipy.special import loggamma
from scipy.integrate import quad
from scipy.stats import median_abs_deviation

# ------------------------------------------------------------------
# Bias-correction constants (user-approved implementations)
# ------------------------------------------------------------------

@lru_cache(maxsize=None)
def c4(n: int) -> float:
    """Bias correction constant for standard deviation."""
    return np.exp(
        np.log(np.sqrt(2 / (n - 1)))
        + loggamma(n / 2)
        - loggamma((n - 1) / 2)
    )


@lru_cache(maxsize=None)
def d2(n: int) -> float:
    """Bias correction constant for the range."""
    f = lambda x, n: 1 - (1 - norm.cdf(x)) ** n - (norm.cdf(x)) ** n
    return quad(f, -np.inf, np.inf, args=(n,))[0]


# ------------------------------------------------------------------
# Main computation function
# ------------------------------------------------------------------

def compute_descriptive_statistics(
    data,
    *,
    quantile_probs=(0.25, 0.5, 0.75),
    trim_alpha=None,
    winsor_limits=None,
    weights=None,
):
    """
    Compute all descriptive statistics for a single numeric variable.
    """

    # --- preparation ------------------------------------------------
    x = pd.Series(data).dropna().astype(float)
    n = len(x)

    rows = []

    # ----------------------------------------------------------------
    # Quantiles
    # ----------------------------------------------------------------
    probs = np.atleast_1d(quantile_probs)
    q_vals = np.quantile(x, probs)
    for p, q in zip(probs, q_vals):
        rows.append([
            "Quantiles",
            f"Q{p}",
            q,
            np.nan,
            0
        ])

    # ----------------------------------------------------------------
    # Central Tendency
    # ----------------------------------------------------------------

    mean = x.mean()
    median = np.median(x)
    iq_mean = trim_mean(x, 0.25)

    rows.extend([
        ["Central Tendency", "Mean", mean, np.nan, 0],
        ["Central Tendency", "Median", median, np.nan, 1],
        ["Central Tendency", "Interquartile Mean", iq_mean, np.nan, 1],
    ])

    # Weighted mean (additional, never replaces mean)
    if weights is not None:
        w = pd.Series(weights).loc[x.index].astype(float)
        w_mean = np.average(x, weights=w)
        rows.append([
            "Central Tendency",
            "Weighted Mean",
            w_mean,
            np.nan,
            0
        ])

    # Trimmed mean
    if trim_alpha is not None:
        t_mean = trim_mean(x, trim_alpha)
        rows.append([
            "Central Tendency",
            f"Trimmed Mean ({trim_alpha})",
            t_mean,
            np.nan,
            1
        ])

    # Winsorized mean
    if winsor_limits is not None:
        from scipy.stats.mstats import winsorize
        xw = winsorize(x, winsor_limits)
        rows.append([
            "Central Tendency",
            f"Winsorized Mean {tuple(winsor_limits)}",
            np.mean(xw),
            np.nan,
            1
        ])

    # Geometric & harmonic means
    if np.all(x > 0):
        rows.extend([
            ["Central Tendency", "Geometric Mean", gmean(x), np.nan, 0],
            ["Central Tendency", "Harmonic Mean", hmean(x), np.nan, 0],
        ])

    # ----------------------------------------------------------------
    # Dispersion
    # ----------------------------------------------------------------

    var0 = np.var(x, ddof=0)
    var1 = np.var(x, ddof=1)   # unbiased
    std0 = np.std(x, ddof=0)
    std1 = np.std(x, ddof=1)
    rng = x.max() - x.min()
    iqr = np.subtract(*np.percentile(x, [75, 25]))
    mad = median_abs_deviation(x)
    aad = np.mean(np.abs(x - mean))

    rows.extend([
        ["Dispersion", "Variance (ddof=0)", var0, var1, 0],
        ["Dispersion", "Variance (ddof=1)", var1, var1, 0],
        ["Dispersion", "Std (ddof=0)", std0, std0 * np.sqrt(n / (n - 1)) / c4(n), 0],
        ["Dispersion", "Std (ddof=1)", std1, std1 / c4(n), 0],
        ["Dispersion", "Range", rng, rng / d2(n), 0],
        ["Dispersion", "AAD", aad, aad * np.sqrt(np.pi / 2), 0],
        ["Dispersion", "IQR", iqr, iqr / (2 * norm.ppf(0.75)), 1],
        ["Dispersion", "MAD", mad, mad / norm.ppf(0.75), 1],
    ])

    # ----------------------------------------------------------------
    # Shape
    # ----------------------------------------------------------------

    rows.extend([
        ["Shape", "Skewness (k-statistic)", skew(x, bias=False), np.nan, 0],
        ["Shape", "Kurtosis (k-statistic)", kurtosis(x, fisher=False, bias=False), np.nan, 0],
    ])

    # ----------------------------------------------------------------
    # Final table
    # ----------------------------------------------------------------

    return pd.DataFrame(
        rows,
        columns=[
            "Statistic Type",
            "Measure",
            "Value",
            "Bias Corrected",
            "Robust",
        ],
    )


def compute_histogram(series: pd.Series) -> dict:
    n = len(series)
    if n < 2:
        return {"binEdges": [], "counts": []}
    q1v = series.quantile(0.25)
    q3v = series.quantile(0.75)
    iqrV = q3v - q1v
    data_range = series.max() - series.min()
    if iqrV == 0:
        num_bins = int(min(30, np.ceil(np.sqrt(n))))
    else:
        bin_width = 2 * (iqrV / np.cbrt(n))
        num_bins = int(min(50, max(5, np.ceil(data_range / bin_width))))
    counts, bin_edges = np.histogram(series, bins=num_bins)
    return {"binEdges": bin_edges.tolist(), "counts": counts.tolist()}


def compute_boxplot_data(series: pd.Series) -> dict:
    q1 = float(series.quantile(0.25))
    med = float(series.median())
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1
    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr
    outliers = series[(series < lower_fence) | (series > upper_fence)].tolist()
    return {
        "whiskerLo": lower_fence,
        "q1": q1,
        "median": med,
        "q3": q3,
        "whiskerHi": upper_fence,
        "outliers": outliers,
    }

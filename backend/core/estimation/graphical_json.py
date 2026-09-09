"""JSON/Plotly adapter for graphical analysis.

`graphical_analysis.py` is kept byte-identical to `ThotsakanStatistics/core/`
so the professor can verify it directly; it returns matplotlib figures, which
the React frontend cannot consume. This module is the parallel, serializable
path: same statistics, expressed as plain lists a Plotly trace can read.

Pure math only — no service, api or session imports.
"""

from __future__ import annotations

import math
from typing import Iterable, Optional

import numpy as np
from scipy.stats import norm

NORMAL_GRID_POINTS = 200
KDE_GRID_POINTS = 500
MAX_RUG_POINTS = 5000

# Below this spread the sample is treated as constant: a Gaussian KDE degenerates
# to a spike of ~1e14 on a zero-width axis, which erases every other trace.
MIN_SPREAD = 1e-12


class DegenerateDataError(ValueError):
    """The sample cannot support the requested computation (too few / no spread)."""


def _finite(values: Iterable[float]) -> bool:
    return all(math.isfinite(float(v)) for v in values)


def has_spread(data: np.ndarray) -> bool:
    """True when the sample varies enough for density estimation to mean anything."""
    arr = np.asarray(data, dtype=float)
    return arr.size >= 2 and float(np.ptp(arr)) > MIN_SPREAD


def compute_histogram_data(data: np.ndarray, bins=None) -> dict:
    """Histogram counts + densities. *bins* is a bin count; None means 'auto'."""
    data = np.asarray(data, dtype=float)
    if data.size < 1:
        raise DegenerateDataError("A histogram needs at least one observation.")

    bin_spec = "auto" if bins is None else int(bins)
    counts, bin_edges = np.histogram(data, bins=bin_spec)
    densities, _ = np.histogram(data, bins=bin_edges, density=True)
    return {
        "bins": bin_edges.tolist(),
        "counts": counts.tolist(),
        "densities": densities.tolist(),
    }


def compute_pmf_data(data: np.ndarray) -> dict:
    values, counts = np.unique(np.asarray(data, dtype=float), return_counts=True)
    probs = counts / counts.sum()
    return {"values": values.tolist(), "probs": probs.tolist()}


def compute_ecdf_data(data: np.ndarray, *, alpha: float = 0.05, add_conf_band: bool = True) -> dict:
    """
    Empirical CDF with an optional DKW band at level 1 - alpha.

    statsmodels' ECDF prepends -inf to x; that value is not JSON-representable,
    so the leading point is dropped (the step at data.min() is unchanged).
    """
    from statsmodels.distributions.empirical_distribution import ECDF

    data = np.asarray(data, dtype=float)
    if data.size < 1:
        raise DegenerateDataError("An ECDF needs at least one observation.")

    ecdf = ECDF(data)
    x = np.asarray(ecdf.x, dtype=float)
    y = np.asarray(ecdf.y, dtype=float)
    finite = np.isfinite(x)
    x, y = x[finite], y[finite]

    epsilon = float(np.sqrt(np.log(2.0 / alpha) / (2.0 * data.size)))

    out = {"x": x.tolist(), "y": y.tolist(), "epsilon": epsilon}
    if add_conf_band:
        out["lower"] = np.maximum(y - epsilon, 0.0).tolist()
        out["upper"] = np.minimum(y + epsilon, 1.0).tolist()
    return out


def compute_kde_data(data: np.ndarray) -> dict:
    """
    Gaussian KDE on the observed range.

    A constant (or single-point) sample has no bandwidth: scipy either raises or
    returns a ~1e14 spike on a zero-width axis. Both are useless to plot, so the
    caller is told to skip the curve instead.
    """
    from scipy.stats import gaussian_kde

    data = np.asarray(data, dtype=float)
    if data.size < 2:
        raise DegenerateDataError("A density curve needs at least two observations.")
    if not has_spread(data):
        raise DegenerateDataError(
            "Every observation has the same value, so there is no density to estimate."
        )

    kde = gaussian_kde(data)
    x_grid = np.linspace(data.min(), data.max(), KDE_GRID_POINTS)
    y_grid = kde.evaluate(x_grid)
    if not np.all(np.isfinite(y_grid)):
        raise DegenerateDataError("The density estimate did not converge for this sample.")
    return {"x": x_grid.tolist(), "y": y_grid.tolist()}


def compute_normal_density_data(
    data: np.ndarray,
    *,
    is_cdf: bool = False,
    hat_mu: Optional[float] = None,
    hat_sigma: Optional[float] = None,
) -> dict:
    """
    Normal PDF/CDF on a hat_mu +/- 3*hat_sigma grid — the same grid the matplotlib
    overlay uses. Falls back to the sample mean and s (ddof=1) when no estimates
    are supplied.
    """
    data = np.asarray(data, dtype=float)
    mu = float(data.mean()) if hat_mu is None else float(hat_mu)
    sigma = float(data.std(ddof=1)) if hat_sigma is None else float(hat_sigma)

    if not math.isfinite(mu) or not math.isfinite(sigma):
        raise DegenerateDataError("The normal overlay estimates are not finite for this sample.")
    if sigma <= 0:
        raise DegenerateDataError(
            "A normal overlay needs a positive deviation estimate; this sample has no spread."
        )

    x_grid = np.linspace(mu - 3.0 * sigma, mu + 3.0 * sigma, NORMAL_GRID_POINTS)
    y_grid = norm.cdf(x_grid, mu, sigma) if is_cdf else norm.pdf(x_grid, mu, sigma)
    return {"x": x_grid.tolist(), "y": y_grid.tolist(), "mu": mu, "sigma": sigma}


def compute_rug_data(data: np.ndarray, *, max_points: int = MAX_RUG_POINTS) -> dict:
    """Raw observations for the rug plot, evenly subsampled above *max_points*."""
    values = np.sort(np.asarray(data, dtype=float))
    n = values.size
    if n > max_points:
        idx = np.linspace(0, n - 1, max_points).astype(int)
        values = values[idx]
    return {"x": values.tolist(), "n_shown": int(values.size), "n_total": int(n)}


def compute_interval_bands(specs) -> list:
    """
    Normalize interval endpoints for the Plotly interval strip.

    Analytic helpers return tuples and bootstrap helpers return length-2 arrays,
    so both are coerced to plain floats. A degenerate sample can make an endpoint
    NaN (a zero-variance CI, say); those bands are dropped rather than emitted,
    because a non-finite float cannot be JSON-encoded and would fail the whole
    response.
    """
    bands, dropped = [], []
    for label, kind, interval in specs:
        if interval is None:
            continue
        low, high = float(interval[0]), float(interval[1])
        if not _finite((low, high)):
            dropped.append(label)
            continue
        bands.append({
            "label": label,
            "kind": kind,
            "low": low,
            "high": high,
            "center": (low + high) / 2.0,
        })
    return bands, dropped


def compute_summary(data: np.ndarray) -> dict:
    arr = np.asarray(data, dtype=float)
    return {"n": int(arr.size), "n_unique": int(np.unique(arr).size)}

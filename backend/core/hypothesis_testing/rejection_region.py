"""
Rejection-region and critical-value data for the hypothesis tests.

Additive sibling to this package's ``__init__.py``, which is kept byte-identical
to ``ThotsakanStatistics/core/hypothesis_tests.py`` so the professor can verify
the math. Nothing here modifies that file.

The original Gradio app reports only a statistic and a p-value. These functions
add the decision layer the lab bench needs: a significance level, the critical
value(s) it implies, the region where H0 is rejected, and the area the observed
statistic actually cuts off. Output is plain JSON-serialisable data — the
frontend draws it with Plotly.
"""

from __future__ import annotations

import numpy as np
from scipy.stats import chi2 as _chi2
from scipy.stats import f as _f
from scipy.stats import t as _t

# Distributions the four supported tests can live on.
#   t     -> one-sample and two-sample Student's t
#   chi2  -> Bartlett's test
#   f     -> Levene's test and one-way ANOVA
_DISTRIBUTIONS = {"t": _t, "chi2": _chi2, "f": _f}

# chi2 and F are non-negative and only ever reject in the upper tail, no matter
# what the user's alternative-hypothesis radio last held.
_UPPER_TAIL_ONLY = ("chi2", "f")

TWO_SIDED = "two-sided"
GREATER = "greater"
LESS = "less"


def resolve_tail(dist: str, alternative: str) -> str:
    """
    The tail actually used to build the rejection region.

    Bartlett, Levene and ANOVA are upper-tail regardless of `alternative`;
    only the t-tests honour the user's choice.
    """
    if dist in _UPPER_TAIL_ONLY:
        return GREATER
    if alternative not in (TWO_SIDED, GREATER, LESS):
        raise ValueError(f"Unknown alternative hypothesis: {alternative}")
    return alternative


def _critical_values(rv, tail: str, alpha: float) -> list[float]:
    if tail == TWO_SIDED:
        half = alpha / 2.0
        return [float(rv.ppf(half)), float(rv.ppf(1.0 - half))]
    if tail == GREATER:
        return [float(rv.ppf(1.0 - alpha))]
    return [float(rv.ppf(alpha))]


# How far past the null scale the observed statistic is allowed to stretch the
# grid before it is simply left off-scale.
_STAT_SPAN_LIMIT = 2.0


def _grid(dist: str, rv, statistic: float, criticals: list[float], n_points: int):
    """
    x grid sized to the null distribution, not to the observed statistic.

    Critical values are always on-canvas: a small alpha pushes them past the
    0.9995 quantile and the red edge is the whole point of the picture.

    The statistic is different. A t of 52 against t(137) would stretch the grid
    to +-62 and collapse the curve into an unreadable spike — which is exactly
    what a strongly significant result looks like, and exactly when the student
    most needs to see the shape. So it widens the grid only up to
    ``_STAT_SPAN_LIMIT`` times the null scale; past that it is reported
    off-scale and the frontend pins its marker to the axis edge.
    """
    if dist == "t":
        null_span = max(4.0, float(rv.ppf(0.9995)))
        span = max(null_span, *(abs(c) for c in criticals))
        span = max(span, min(abs(statistic) * 1.2, null_span * _STAT_SPAN_LIMIT))
        return np.linspace(-span, span, n_points)

    null_span = max(float(rv.ppf(0.999)), 1.0)
    upper = max(null_span, *(abs(c) for c in criticals))
    upper = max(upper, min(abs(statistic) * 1.2, null_span * _STAT_SPAN_LIMIT))
    return np.linspace(0.0, upper, n_points)


def _density(rv, x):
    """
    Null density on the grid, plus a y-axis ceiling that keeps the curve readable.

    With one degree of freedom the density diverges at the left edge: chi2(1) and
    F(1, n) both reach ~64 near zero against a useful scale of ~0.5, and
    ``chi2.pdf(0, 1)`` is literally ``inf`` (which is not valid JSON). That case
    is not exotic — Levene's test with two groups is F(1, N-2) and is the default
    the student meets first.

    So: report a ceiling of 1.6x the density at the distribution's median, which
    leaves a well-behaved curve untouched (for t the ceiling sits above the peak
    and nothing is clipped) but crops a df=1 spike to something legible. Any
    non-finite sample is pinned to that ceiling so the payload stays serialisable.
    """
    pdf = np.asarray(rv.pdf(x), dtype=float)
    finite = pdf[np.isfinite(pdf)]

    ceiling = 1.6 * float(rv.pdf(rv.median()))
    peak = float(finite.max()) if finite.size else ceiling
    y_max = min(peak, ceiling)

    return np.where(np.isfinite(pdf), np.minimum(pdf, y_max), y_max), y_max


def _regions(tail: str, bounds: list[float], x_lo: float, x_hi: float) -> list[list[float]]:
    """
    Shaded intervals for a tail rule, clipped to the plotted grid.

    `bounds` is what defines the edge of the shading: the critical value(s) for
    the rejection region, or the observed statistic for the p-value area.

    An off-scale statistic collapses its interval to a zero-width sliver at the
    edge rather than producing an inverted one — the right reading for a p-value
    too small to draw.
    """
    def clip(lo: float, hi: float) -> list[float]:
        return [min(max(lo, x_lo), x_hi), min(max(hi, x_lo), x_hi)]

    if tail == TWO_SIDED:
        edge = abs(bounds[-1])
        return [clip(x_lo, -edge), clip(edge, x_hi)]
    if tail == GREATER:
        return [clip(bounds[-1], x_hi)]
    return [clip(x_lo, bounds[0])]


def compute_rejection_region_data(
    *,
    dist: str,
    dof: tuple[float, ...],
    statistic: float,
    p_value: float,
    alpha: float,
    tail: str,
    n_points: int = 400,
) -> dict:
    """
    Null-distribution curve, critical value(s), rejection region and p-value area.

    Two regions come back, not one. ``reject_region`` is fixed by alpha and
    ``p_area`` by the observed statistic — they are different things, and having
    both is what lets the UI show where the statistic landed before it reveals
    the number.

    Parameters
    ----------
    dist        "t", "chi2" or "f".
    dof         (df,) for t and chi2; (df1, df2) for F.
    statistic   Observed test statistic.
    p_value     p-value reported by the test itself.
    alpha       Significance level.
    tail        "two-sided", "greater" or "less"; coerced upper-tail for chi2/F.
    n_points    Resolution of the plotted curve.
    """
    if dist not in _DISTRIBUTIONS:
        raise ValueError(f"Unknown null distribution: {dist}")
    if not 0.0 < alpha < 1.0:
        raise ValueError("alpha must be strictly between 0 and 1.")

    dof = tuple(float(d) for d in dof)
    if any(d <= 0 for d in dof):
        raise ValueError("Degrees of freedom must be positive.")

    expected_dof = 2 if dist == "f" else 1
    if len(dof) != expected_dof:
        raise ValueError(f"Distribution '{dist}' expects {expected_dof} degrees-of-freedom value(s).")

    tail = resolve_tail(dist, tail)
    rv = _DISTRIBUTIONS[dist](*dof)

    statistic = float(statistic)
    criticals = _critical_values(rv, tail, alpha)

    x = _grid(dist, rv, statistic, criticals, n_points)
    pdf, y_max = _density(rv, x)

    x_lo, x_hi = float(x[0]), float(x[-1])

    return {
        "dist": dist,
        "dof": list(dof),
        "x": x.tolist(),
        "pdf": pdf.tolist(),
        "y_max": y_max,
        "x_range": [x_lo, x_hi],
        "statistic": statistic,
        "statistic_offscale": not (x_lo <= statistic <= x_hi),
        "critical_values": criticals,
        "reject_region": _regions(tail, criticals, x_lo, x_hi),
        "p_area": _regions(tail, [statistic], x_lo, x_hi),
        "tail": tail,
        "reject": bool(float(p_value) < alpha),
    }

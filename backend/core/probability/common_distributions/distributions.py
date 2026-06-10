"""
PMF/PDF, CDF, theoretical stats, and plot-grid generation for 12 distributions.
All computation uses scipy.stats; x-grid range mirrors the frontend DISTRIBUTIONS catalogue.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy import stats as sp


# ── x-grid helpers ─────────────────────────────────────────────────────────────

def _discrete_max_k(dist_name: str, params: dict) -> int:
    p = params
    match dist_name:
        case 'Poisson':
            return int(math.ceil(p['lambda'] + 5 * math.sqrt(p['lambda']))) + 1
        case 'Binomial':
            return int(p['n'])
        case 'Geometric':
            return int(math.ceil(1 / p['p'] + 10 * math.sqrt((1 - p['p']) / (p['p'] ** 2))))
        case 'Negative Binomial':
            return int(math.ceil(
                p['r'] * (1 - p['p']) / p['p']
                + 10 * math.sqrt(p['r'] * (1 - p['p']) / (p['p'] ** 2))
            ))
        case 'Hypergeometric':
            return int(p['n'])
        case _:
            return 30


def _continuous_range(dist_name: str, params: dict) -> tuple[float, float]:
    p = params
    match dist_name:
        case 'Normal':
            return (p['mu'] - 4 * p['sigma'], p['mu'] + 4 * p['sigma'])
        case 'Exponential':
            return (0.0, 5.0 / p['lambda'])
        case 'Uniform':
            return (min(p['a'], p['b']) - 0.5, max(p['a'], p['b']) + 0.5)
        case 'Gamma':
            return (0.0, (p['alpha'] + 4 * math.sqrt(p['alpha'])) / p['beta'])
        case 'Beta':
            return (0.0, 1.0)
        case 'Chi-squared':
            return (0.0, p['k'] + 5 * math.sqrt(2 * p['k']))
        case "Student's t":
            bound = min(5.0, p['nu'] + 3)
            return (-bound, bound)
        case _:
            return (-5.0, 5.0)


# ── scipy distribution factory ─────────────────────────────────────────────────

def _make_dist(dist_name: str, params: dict):
    """Return a frozen scipy rv object."""
    p = params
    match dist_name:
        case 'Poisson':
            return sp.poisson(mu=p['lambda'])
        case 'Binomial':
            return sp.binom(n=int(p['n']), p=p['p'])
        case 'Geometric':
            return sp.geom(p=p['p'])          # scipy geometric: k ≥ 1
        case 'Negative Binomial':
            return sp.nbinom(n=int(p['r']), p=p['p'])
        case 'Hypergeometric':
            return sp.hypergeom(M=int(p['N']), n=int(p['K']), N=int(p['n']))
        case 'Normal':
            return sp.norm(loc=p['mu'], scale=p['sigma'])
        case 'Exponential':
            return sp.expon(scale=1.0 / p['lambda'])
        case 'Uniform':
            a, b = p['a'], p['b']
            return sp.uniform(loc=a, scale=b - a)
        case 'Gamma':
            return sp.gamma(a=p['alpha'], scale=1.0 / p['beta'])
        case 'Beta':
            return sp.beta(a=p['alpha'], b=p['beta'])
        case 'Chi-squared':
            return sp.chi2(df=p['k'])
        case "Student's t":
            return sp.t(df=p['nu'])
        case _:
            raise ValueError(f"Unknown distribution: {dist_name!r}")


def _safe_stat(val: Any) -> float | str:
    """Convert scipy stat (may be inf/nan) to float or '∞'."""
    try:
        v = float(val)
        if not math.isfinite(v):
            return '∞'
        return v
    except (TypeError, ValueError):
        return '∞'


# ── query result ───────────────────────────────────────────────────────────────

def _query_result(rv, dist_type: str, query_op: str, query_k: float) -> float:
    """Compute P(X op query_k) using the frozen rv."""
    if dist_type == 'discrete':
        k = int(round(query_k))
        match query_op:
            case '=':   return float(rv.pmf(k))
            case '<=':  return float(rv.cdf(k))
            case '<':   return float(rv.cdf(k - 1))
            case '>=':  return float(1 - rv.cdf(k - 1))
            case '>':   return float(1 - rv.cdf(k))
    else:
        match query_op:
            case '<=' | '<':  return float(rv.cdf(query_k))
            case '>=' | '>':  return float(1 - rv.cdf(query_k))
            case '=':         return float(rv.pdf(query_k))
    return 0.0


# ── main entry point ───────────────────────────────────────────────────────────

def compute_distribution(
    dist_name: str,
    params: dict,
    query_op: str,
    query_k: float,
) -> dict:
    """
    Returns full plot data + query result + theoretical stats for one distribution.

    Discrete result keys: ks, probs, cumProbs, queryResult, theorMean, theorVariance
    Continuous result keys: xs, ys, cdfYs, queryResult, theorMean, theorVariance
    """
    rv = _make_dist(dist_name, params)

    theor_mean = _safe_stat(rv.mean())
    theor_var = _safe_stat(rv.var())

    is_discrete = hasattr(rv, 'pmf')

    q_raw = _query_result(rv, 'discrete' if is_discrete else 'continuous', query_op, query_k)
    q_final = float(np.nan_to_num(q_raw, nan=0.0, posinf=1.0, neginf=0.0))
    if not (not is_discrete and query_op == '='):
        q_final = max(0.0, min(1.0, q_final))

    if is_discrete:
        max_k = min(_discrete_max_k(dist_name, params), 60)
        ks = list(range(max_k + 1))
        probs = [float(np.nan_to_num(rv.pmf(k), nan=0.0)) for k in ks]
        cum_probs = [float(np.nan_to_num(rv.cdf(k), nan=0.0)) for k in ks]
        return {
            "ks": ks,
            "probs": probs,
            "cumProbs": cum_probs,
            "queryResult": q_final,
            "theorMean": theor_mean,
            "theorVariance": theor_var,
        }
    else:
        lo, hi = _continuous_range(dist_name, params)
        xs = np.linspace(lo, hi, 201).tolist()
        ys = [float(np.nan_to_num(rv.pdf(x), nan=0.0)) for x in xs]
        cdf_ys = [float(np.nan_to_num(rv.cdf(x), nan=0.0)) for x in xs]
        return {
            "xs": xs,
            "ys": ys,
            "cdfYs": cdf_ys,
            "queryResult": q_final,
            "theorMean": theor_mean,
            "theorVariance": theor_var,
        }

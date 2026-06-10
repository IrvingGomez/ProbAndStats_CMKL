"""
Normal PDF + CI visualization data for the inference tab.
Returns plot-ready arrays: PDF curve, shaded CI region, CDF values.
"""
from __future__ import annotations

import numpy as np
from scipy.stats import norm


def compute_normal_pdf_data(mean: float, std: float, n: int, alpha: float) -> dict:
    spread = 4 * std
    x = np.linspace(mean - spread, mean + spread, 161)

    y = norm.pdf(x, loc=mean, scale=std)
    cdf_y = norm.cdf(x, loc=mean, scale=std)

    se = std / np.sqrt(n)
    z_critical = float(norm.ppf(1 - alpha / 2))
    ci_low = mean - z_critical * se
    ci_high = mean + z_critical * se

    mask = (x >= ci_low) & (x <= ci_high)
    shade_x = x[mask].tolist()
    shade_y = y[mask].tolist()
    if shade_x:
        shade_x = [shade_x[0]] + shade_x + [shade_x[-1]]
        shade_y = [0.0] + shade_y + [0.0]

    return {
        "xValues": x.tolist(),
        "yValues": y.tolist(),
        "cdfValues": cdf_y.tolist(),
        "ciLow": ci_low,
        "ciHigh": ci_high,
        "shadeX": shade_x,
        "shadeY": shade_y,
        "se": float(se),
        "zCritical": z_critical,
    }

# stats/inference/confidence_regions.py

import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import chi2

from .likelihood import relative_likelihood


def confidence_regions(
    *,
    data,
    mean_ci,
    sigma_ci,
    probs,
    eps_mu,
    eps_sigma,
    add_ci_box,
):
    """
    Likelihood-based confidence regions for (μ, σ).
    """

    # Reverse probs to match chi² nesting
    probs = probs[::-1]
    levels = np.exp(-0.5 * chi2.ppf(probs, 2))

    mu_grid = np.linspace(
        mean_ci[0] - eps_mu[0],
        mean_ci[1] + eps_mu[1],
        200,
    )
    sigma_grid = np.linspace(
        sigma_ci[0] - eps_sigma[0],
        sigma_ci[1] + eps_sigma[1],
        200,
    )

    MU, SIGMA = np.meshgrid(mu_grid, sigma_grid)

    sigma_hat = np.std(data, ddof=0)
    mu_hat = np.mean(data)

    Z = relative_likelihood(
        data=data,
        mu=MU,
        sigma=SIGMA,
        sigma_hat=sigma_hat,
    )

    fig, ax = plt.subplots(figsize=(8, 6))

    contour = ax.contour(
        MU,
        SIGMA,
        Z,
        levels=levels,
        cmap="plasma",
    )

    # MLE
    ax.scatter(mu_hat, sigma_hat, c="black", s=60, label="MLE", zorder=5)

    if add_ci_box:
        x = [
            mean_ci[0],
            mean_ci[1],
            mean_ci[1],
            mean_ci[0],
            mean_ci[0],
        ]
        y = [
            sigma_ci[0],
            sigma_ci[0],
            sigma_ci[1],
            sigma_ci[1],
            sigma_ci[0],
        ]
        ax.plot(x, y, "r--", label="CI box")

    handles, _ = contour.legend_elements()
    labels = [f"{100*p:.1f}%" for p in probs]
    ax.legend(
        handles + [ax.collections[-1]],
        labels + ["MLE"],
        loc="upper right",
        frameon=True,
    )

    ax.set_title(r"Confidence Regions for $(\mu, \sigma)$")
    ax.set_xlabel(r"$\mu$")
    ax.set_ylabel(r"$\sigma$")
    ax.grid(True, linestyle="--", alpha=0.6)

    plt.tight_layout()
    return fig


def compute_confidence_regions_data(
    *,
    data,
    mean_ci,
    sigma_ci,
    probs,
    eps_mu,
    eps_sigma,
) -> dict:
    probs = probs[::-1]
    levels = np.exp(-0.5 * chi2.ppf(probs, 2))

    mu_grid = np.linspace(mean_ci[0] - eps_mu[0], mean_ci[1] + eps_mu[1], 200)
    sigma_grid = np.linspace(sigma_ci[0] - eps_sigma[0], sigma_ci[1] + eps_sigma[1], 200)
    MU, SIGMA = np.meshgrid(mu_grid, sigma_grid)

    sigma_hat = float(np.std(data, ddof=0))
    mu_hat = float(np.mean(data))

    Z = relative_likelihood(data=data, mu=MU, sigma=SIGMA, sigma_hat=sigma_hat)

    return {
        "z_matrix": Z.tolist(),
        "mu_grid": mu_grid.tolist(),
        "sigma_grid": sigma_grid.tolist(),
        "mu_hat": mu_hat,
        "sigma_hat": sigma_hat,
        "levels": levels.tolist(),
        "probs": list(probs),
    }

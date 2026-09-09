from __future__ import annotations

from typing import Iterable, Optional, Tuple

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import norm


Interval = Optional[Tuple[float, float]]


def _plot_hist_or_pmf(
    ax,
    *,
    data: np.ndarray,
    graph_type: str,
    var_name: str,
    add_kde: bool,
    add_data: bool,
):
    """
    Draw the main histogram / PMF on *ax*.
    Modularized version of the monolithic PlotHistogram logic.
    """
    sns.set_style("whitegrid")

    if graph_type == "Histogram":
        sns.histplot(
            data,
            kde=add_kde,
            stat="density",
            color="rebeccapurple",
            alpha=0.5,
            ax=ax,
        )
        ax.set_ylabel("Density")
        ax.set_xlabel(var_name)
        ax.set_title(f"Distribution of {var_name}")
    elif graph_type == "Empirical Probability Mass Function":
        values, counts = np.unique(data, return_counts=True)
        probs = counts / counts.sum()
        ax.stem(values, probs, basefmt="rebeccapurple", linefmt="rebeccapurple")
        if add_kde:
            sns.kdeplot(data, ax=ax, color="rebeccapurple")
        ax.set_ylabel("Probability")
        ax.set_xlabel(var_name)
        ax.set_title(f"Empirical PMF of {var_name}")
    else:
        raise ValueError(f"Unknown graph type: {graph_type}")

    if add_data:
        _, upper = ax.get_ylim()
        sns.rugplot(data, height=0.1 * upper, ax=ax, color="black")


def _plot_normal_density(
    ax,
    *,
    hat_mu: float,
    hat_sigma: float,
    color: str = "black",
):
    if hat_sigma <= 0:
        return

    y_vect = np.linspace(hat_mu - 3 * hat_sigma, hat_mu + 3 * hat_sigma, 200)
    ax.plot(
        y_vect,
        norm.pdf(y_vect, hat_mu, hat_sigma),
        color=color,
        linestyle="--",
        label="Normal density",
    )
    ax.legend()


def _plot_interval_band(
    ax,
    *,
    y_val: float,
    interval: Tuple[float, float],
    label: str,
    color: str,
):
    low, high = interval
    ax.hlines(y_val, low, high, color=color, linewidth=2)
    ax.scatter((low + high) / 2.0, y_val, color=color, s=30, zorder=5)
    ax.text(
        high,
        y_val,
        f" {label}",
        va="center",
        fontsize=9,
        bbox=dict(
            boxstyle="round,pad=0.2",
            facecolor="whitesmoke",
            edgecolor="gray",
        ),
    )


def plot_histogram_with_overlays(
    *,
    data: Iterable[float],
    graph_type: str,
    var_name: str,
    add_kde: bool,
    add_data: bool,
    add_normal: bool,
    hat_mu: Optional[float],
    hat_sigma: Optional[float],
    ci_mean_interval: Interval,
    ci_median_interval: Interval,
    pi_interval: Interval,
):
    """
    Return a matplotlib Figure for the histogram / PMF with optional overlays.
    """
    data = np.asarray(data)

    show_any_interval = (
        (ci_mean_interval is not None)
        or (ci_median_interval is not None)
        or (pi_interval is not None)
    )

    if show_any_interval:
        fig, (ax1, ax2) = plt.subplots(
            2,
            1,
            sharex=True,
            figsize=(8, 6),
        )
    else:
        fig, ax1 = plt.subplots(1, 1, figsize=(8, 4))
        ax2 = None

    _plot_hist_or_pmf(
        ax1,
        data=data,
        graph_type=graph_type,
        var_name=var_name,
        add_kde=add_kde,
        add_data=add_data,
    )

    if add_normal and hat_mu is not None and hat_sigma is not None:
        _plot_normal_density(ax1, hat_mu=hat_mu, hat_sigma=hat_sigma)

    # Interval annotations (confidence / prediction)
    if show_any_interval and ax2 is not None:
        ax2.set_yticks([])
        ax2.set_xlabel(var_name)
        ax2.set_ylim(0, 0.5)

        ci_base_y = 0.4
        if ci_mean_interval is not None:
            _plot_interval_band(
                ax2,
                y_val=ci_base_y,
                interval=ci_mean_interval,
                label="CI Mean",
                color="blue",
            )
        if ci_median_interval is not None:
            _plot_interval_band(
                ax2,
                y_val=ci_base_y - 0.1,
                interval=ci_median_interval,
                label="CI Median",
                color="green",
            )

        if pi_interval is not None:
            _plot_interval_band(
                ax2,
                y_val=0.1,
                interval=pi_interval,
                label="Prediction Interval",
                color="darkred",
            )

    fig.tight_layout()
    return fig


def plot_ecdf(
    *,
    data: Iterable[float],
    var_name: str,
    alpha: float,
    add_conf_band: bool,
    add_normal: bool,
    hat_mu: Optional[float],
    hat_sigma: Optional[float],
):
    """Modular version of the ECDF plot with optional DKW band and Normal CDF."""
    from statsmodels.distributions.empirical_distribution import ECDF

    data = np.asarray(data)
    ecdf = ECDF(data)

    fig, ax = plt.subplots(figsize=(8, 5))

    # ECDF step
    ax.step(
        ecdf.x,
        ecdf.y,
        where="post",
        color="rebeccapurple",
        linewidth=2,
        label="ECDF",
    )
    ax.scatter(ecdf.x, ecdf.y, color="rebeccapurple", s=10, alpha=0.6)

    # DKW band
    if add_conf_band:
        n = len(data)
        epsilon = np.sqrt(np.log(2.0 / alpha) / (2.0 * n))
        lower = np.clip(ecdf.y - epsilon, 0.0, 1.0)
        upper = np.clip(ecdf.y + epsilon, 0.0, 1.0)
        ax.fill_between(
            ecdf.x,
            lower,
            upper,
            step="post",
            color="plum",
            alpha=0.4,
            label="DKW CI",
        )

    # Optional Normal CDF
    if add_normal and hat_mu is not None and hat_sigma is not None and hat_sigma > 0:
        y_vals = np.linspace(hat_mu - 3.0 * hat_sigma, hat_mu + 3.0 * hat_sigma, 200)
        ax.plot(
            y_vals,
            norm.cdf(y_vals, hat_mu, hat_sigma),
            color="black",
            linestyle="--",
            linewidth=2,
            label="Normal CDF",
        )
        ax.set_xlim(
            min(data.min(), y_vals.min()) - 0.1,
            max(data.max(), y_vals.max()) + 0.1,
        )
    else:
        ax.set_xlim(data.min() - 0.1, data.max() + 0.1)

    ax.set_title("Empirical Cumulative Distribution Function", fontsize=14)
    ax.set_xlabel(var_name, fontsize=12)
    ax.set_ylabel("ECDF", fontsize=12)
    ax.set_ylim(0, 1.05)
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend(loc="lower right", fontsize=10)

    fig.tight_layout()
    return fig

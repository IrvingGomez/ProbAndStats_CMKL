import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import pingouin as pg

from scipy.stats import t, gaussian_kde, bartlett, levene

# ============================================================
# One-sample t-test
# ============================================================

def plot_ttest_mean_distribution(
    numeric_col: str,
    sample: np.ndarray,
    mu0: float,
    df_output: pd.DataFrame,
    alternative: str,
    bootstrap_samples: int,
):
    """
    Plot bootstrap sampling distribution of the mean vs. theoretical t under H0,
    shading the p-value region.
    """
    plt.style.use("seaborn-v0_8-whitegrid")

    # Pingouin output
    p_val = df_output["p-val"].values[0]
    df = df_output["dof"].values[0]

    # Sample stats
    n = len(sample)
    sample_mean = np.mean(sample)
    sample_std = np.std(sample, ddof=1)
    se = sample_std / np.sqrt(n)

    # Theoretical t-distribution under H0
    x = np.linspace(mu0 - 5 * se, mu0 + 5 * se, 1000)
    t_density = t.pdf((x - mu0) / se, df) / se

    # Bootstrap sampling distribution of the mean
    boot_means = np.array(
        [
            np.mean(np.random.choice(sample, size=n, replace=True))
            for _ in range(bootstrap_samples)
        ]
    )

    # KDE for bootstrap means (off-screen fig to get line data)
    fig_tmp, ax_tmp = plt.subplots()
    sns.kdeplot(boot_means, bw_adjust=1.2, ax=ax_tmp)
    x_kde, y_kde = ax_tmp.lines[0].get_data()
    plt.close(fig_tmp)

    # Final figure
    fig, ax = plt.subplots(figsize=(8, 5))

    # Bootstrap KDE
    ax.plot(
        x_kde,
        y_kde,
        color="rebeccapurple",
        label="Bootstrap sampling dist.",
        linewidth=2,
    )

    # Theoretical t under H0
    ax.plot(
        x,
        t_density,
        color="gray",
        linestyle="--",
        linewidth=2,
        label=r"$t$-distribution ($H_0$)",
    )

    # Shade p-value region
    if alternative == "two-sided":
        delta = abs(sample_mean - mu0)
        lower = mu0 - delta
        upper = mu0 + delta
        mask = (x <= lower) | (x >= upper)
    elif alternative == "greater":
        mask = x >= sample_mean
    elif alternative == "less":
        mask = x <= sample_mean
    else:
        raise ValueError("alternative must be 'two-sided', 'greater', or 'less'")

    ax.fill_between(
        x,
        0,
        t_density,
        where=mask,
        color="red",
        alpha=0.3,
        label=f"p-value ≈ {p_val:.3f}",
    )

    # Reference lines
    ax.axvline(
        mu0,
        color="tab:orange",
        linestyle="--",
        linewidth=2,
        label=rf"$\mu_0 = {mu0}$",
    )
    ax.axvline(
        sample_mean,
        color="black",
        linestyle="-",
        linewidth=1.5,
        label=rf"Sample mean = {sample_mean:.2f}",
    )

    # Formatting
    ax.set_title(
        f"Sampling Distribution of the Mean ({numeric_col})",
        fontsize=14,
    )
    ax.set_xlabel("Sample Mean", fontsize=12)
    ax.set_ylabel("Density", fontsize=12)
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend()
    plt.tight_layout()

    return fig


def one_sample_ttest(
    sample: np.ndarray,
    mu0: float,
    alternative: str,
    *,
    numeric_col: str,
    bootstrap_samples: int,
    include_graph: bool,
) -> tuple[pd.DataFrame, plt.Figure | None]:
    """
    One-sample Student's t-test and optional sampling distribution plot.
    """
    if sample.size == 0:
        raise ValueError("No valid data in the selected column.")

    df_output = pg.ttest(
        x=sample,
        y=mu0,
        alternative=alternative,
        paired=False,
    )

    fig = None
    if include_graph:
        fig = plot_ttest_mean_distribution(
            numeric_col=numeric_col,
            sample=sample,
            mu0=mu0,
            df_output=df_output,
            alternative=alternative,
            bootstrap_samples=bootstrap_samples,
        )

    return df_output, fig


# ============================================================
# Two-sample t-test (means)
# ============================================================


def mirror_plot(
    numeric_col: str,
    group1: np.ndarray,
    name_group1: str,
    group2: np.ndarray,
    name_group2: str,
    df_output: pd.DataFrame,
):
    """
    Mirror histogram + KDE plot for two groups.
    """
    t_val = df_output["T"].values[0]
    p_val = df_output["p-val"].values[0]

    mean1 = np.mean(group1)
    mean2 = np.mean(group2)

    fig, ax = plt.subplots(figsize=(10, 6))

    # Shared binning
    combined = np.concatenate([group1, group2])
    x_min, x_max = float(np.min(combined)), float(np.max(combined))
    bin_range = np.linspace(x_min, x_max, 30)
    bin_centers = (bin_range[:-1] + bin_range[1:]) / 2
    bin_width = np.diff(bin_range)[0]
    x_vals = np.linspace(x_min, x_max, 200)

    # Group 1 (top)
    sns.histplot(
        group1,
        bins=bin_range,
        stat="density",
        kde=False,
        color="rebeccapurple",
        label=name_group1,
        alpha=0.6,
        ax=ax,
    )
    kde1 = gaussian_kde(group1)
    ax.plot(x_vals, kde1(x_vals), color="rebeccapurple", linewidth=2)
    ax.axvline(
        mean1,
        color="rebeccapurple",
        linestyle="--",
        linewidth=2,
        label=f"{name_group1} mean = {mean1:.2f}",
    )

    # Group 2 (bottom, mirrored)
    heights2, _ = np.histogram(group2, bins=bin_range, density=True)
    ax.bar(
        bin_centers,
        -heights2,
        width=bin_width,
        color="tab:orange",
        edgecolor="black",
        alpha=0.6,
        label=name_group2,
    )
    kde2 = gaussian_kde(group2)
    ax.plot(x_vals, -kde2(x_vals), color="tab:orange", linewidth=2)
    ax.axvline(
        mean2,
        color="tab:orange",
        linestyle="--",
        linewidth=2,
        label=f"{name_group2} mean = {mean2:.2f}",
    )

    ax.axhline(0, color="black", linewidth=1)

    ax.set_title("Mirror Plot: Two-Sample Distribution Comparison", fontsize=14)
    ax.set_xlabel(numeric_col)
    ax.set_ylabel("Density (Top ↑ vs. Bottom ↓)", fontsize=11)

    ax.text(
        0.01,
        0.95,
        f"p = {p_val:.3f}",
        transform=ax.transAxes,
        fontsize=11,
        verticalalignment="top",
        bbox=dict(boxstyle="round", facecolor="white", alpha=0.6),
    )

    ax.legend()
    plt.tight_layout()
    return fig


def plot_mean_distribution(
    group1: np.ndarray,
    name_group1: str,
    group2: np.ndarray,
    name_group2: str,
    bootstrap_samples: int,
    df_output: pd.DataFrame,
):
    """
    Bootstrap distributions of the two sample means.
    """
    p_val = df_output["p-val"].values[0]

    mean1 = np.mean(group1)
    mean2 = np.mean(group2)

    boot1 = [
        np.mean(np.random.choice(group1, size=len(group1), replace=True))
        for _ in range(bootstrap_samples)
    ]
    boot2 = [
        np.mean(np.random.choice(group2, size=len(group2), replace=True))
        for _ in range(bootstrap_samples)
    ]

    fig, ax = plt.subplots(figsize=(8, 5))
    sns.kdeplot(
        boot1,
        label=f"{name_group1} mean",
        fill=True,
        color="rebeccapurple",
        alpha=0.6,
        ax=ax,
    )
    sns.kdeplot(
        boot2,
        label=f"{name_group2} mean",
        fill=True,
        color="tab:orange",
        alpha=0.6,
        ax=ax,
    )

    ax.axvline(mean1, color="rebeccapurple", linestyle="--", linewidth=2)
    ax.axvline(mean2, color="tab:orange", linestyle="--", linewidth=2)

    ax.set_title("Bootstrap Mean Distributions", fontsize=14)
    ax.set_xlabel("Mean", fontsize=12)
    ax.set_ylabel("Density", fontsize=12)
    ax.grid(True, linestyle="--", alpha=0.5)

    ax.text(
        0.98,
        0.95,
        f"p = {round(p_val, 3)}\n"
        f"Mean({name_group1}) = {round(mean1, 2)}\n"
        f"Mean({name_group2}) = {round(mean2, 2)}",
        transform=ax.transAxes,
        ha="right",
        va="top",
        bbox=dict(boxstyle="round", facecolor="white", alpha=0.7),
        fontsize=11,
    )

    ax.legend()
    plt.tight_layout()

    return fig


def two_sample_ttest(
    group1: np.ndarray,
    group2: np.ndarray,
    *,
    numeric_col: str,
    name_group1: str,
    name_group2: str,
    alternative: str,
    correction: bool,
    plot_type: str,
    bootstrap_samples: int,
    include_graph: bool,
) -> tuple[pd.DataFrame, plt.Figure | None]:
    """
    Two-sample Student's t-test (pingouin.ttest) plus optional plots.
    """
    if group1.size == 0 or group2.size == 0:
        raise ValueError("One or both groups are empty after filtering.")

    df_output = pg.ttest(
        x=group1,
        y=group2,
        alternative=alternative,
        paired=False,
        correction=correction,
    )

    fig = None
    if include_graph:
        if plot_type == "Sample Histogram":
            fig = mirror_plot(
                numeric_col=numeric_col,
                group1=group1,
                name_group1=name_group1,
                group2=group2,
                name_group2=name_group2,
                df_output=df_output,
            )
        elif plot_type == "Mean Density":
            fig = plot_mean_distribution(
                group1=group1,
                name_group1=name_group1,
                group2=group2,
                name_group2=name_group2,
                bootstrap_samples=bootstrap_samples,
                df_output=df_output,
            )

    return df_output, fig


# ============================================================
# Variance tests (Bartlett / Levene)
# ============================================================


def plot_variance_distribution(
    p: float,
    group1: np.ndarray,
    name_group1: str,
    var1: float,
    group2: np.ndarray,
    name_group2: str,
    var2: float,
    method: str,
    bootstrap_samples: int,
):
    """
    Bootstrap distributions of sample variances for two groups.
    """
    boot1 = [
        np.var(np.random.choice(group1, size=len(group1), replace=True), ddof=1)
        for _ in range(bootstrap_samples)
    ]
    boot2 = [
        np.var(np.random.choice(group2, size=len(group2), replace=True), ddof=1)
        for _ in range(bootstrap_samples)
    ]

    fig, ax = plt.subplots(figsize=(8, 5))
    sns.kdeplot(
        boot1,
        label=f"{name_group1} variance",
        fill=True,
        color="rebeccapurple",
        alpha=0.6,
        ax=ax,
    )
    sns.kdeplot(
        boot2,
        label=f"{name_group2} variance",
        fill=True,
        color="tab:orange",
        alpha=0.6,
        ax=ax,
    )

    ax.axvline(var1, color="rebeccapurple", linestyle="--", linewidth=2)
    ax.axvline(var2, color="tab:orange", linestyle="--", linewidth=2)

    ax.set_title(f"Bootstrap Variance Distributions\n{method}", fontsize=14)
    ax.set_xlabel("Variance", fontsize=12)
    ax.set_ylabel("Density", fontsize=12)
    ax.grid(True, linestyle="--", alpha=0.5)

    ax.text(
        0.98,
        0.95,
        f"{method}\n"
        f"p = {round(p, 3)}\n"
        f"Var({name_group1}) = {round(var1, 2)}\n"
        f"Var({name_group2}) = {round(var2, 2)}",
        transform=ax.transAxes,
        ha="right",
        va="top",
        bbox=dict(boxstyle="round", facecolor="white", alpha=0.7),
        fontsize=11,
    )

    ax.legend()
    plt.tight_layout()

    return fig


def variance_test(
    group1: np.ndarray,
    group2: np.ndarray,
    *,
    name_group1: str,
    name_group2: str,
    test_type: str,
    include_graph: bool,
    bootstrap_samples: int,
) -> tuple[pd.DataFrame, plt.Figure | None]:
    """
    Bartlett or Levene test + optional bootstrap variance plots.
    """
    if group1.size == 0 or group2.size == 0:
        raise ValueError("One or both groups are empty after filtering.")

    if test_type == "Bartlett":
        stat, p = bartlett(group1, group2)
        method = "Bartlett's test"
    elif test_type == "Levene":
        stat, p = levene(group1, group2, center="mean")
        method = "Levene's test"
    else:
        raise ValueError("Invalid test type selected.")

    var1 = float(np.var(group1, ddof=1))
    var2 = float(np.var(group2, ddof=1))

    df_output = pd.DataFrame(
        {
            "Test": [method],
            "Statistic": [stat],
            "p-value": [p],
            f"Var({name_group1})": [var1],
            f"Var({name_group2})": [var2],
        }
    )

    fig = None
    if include_graph:
        fig = plot_variance_distribution(
            p=p,
            group1=group1,
            name_group1=name_group1,
            var1=var1,
            group2=group2,
            name_group2=name_group2,
            var2=var2,
            method=method,
            bootstrap_samples=bootstrap_samples,
        )

    return df_output, fig


# ============================================================
# One-way ANOVA
# ============================================================


def one_way_anova_plot(
    data_group: pd.DataFrame,
    numeric_col: str,
    cat_col: str,
    df_output: pd.DataFrame,
):
    """
    KDE plot of group distributions with F/p annotation.
    """
    p_val = df_output["p-unc"].values[0]

    groups = sorted(data_group[cat_col].dropna().unique())
    palette = sns.color_palette("tab10", n_colors=len(groups))
    group_color_map = dict(zip(groups, palette))

    fig, ax = plt.subplots(figsize=(8, 5))

    for group in groups:
        subset = data_group[data_group[cat_col] == group][numeric_col].dropna()
        sns.kdeplot(
            subset,
            fill=True,
            common_norm=False,
            color=group_color_map[group],
            alpha=0.5,
            linewidth=1,
            label=str(group),
            ax=ax,
        )

    overall_mean = data_group[numeric_col].mean()
    ax.axvline(
        overall_mean,
        color="black",
        linestyle=":",
        linewidth=1.2,
        label="Overall mean",
    )

    group_means = data_group.groupby(cat_col)[numeric_col].mean()
    for group, mean_val in group_means.items():
        ax.axvline(
            mean_val,
            color=group_color_map[group],
            linestyle="--",
            linewidth=1.5,
            label=f"{group} mean",
        )

    ax.text(
        0.98,
        0.95,
        f"p = {p_val:.3f}",
        transform=ax.transAxes,
        ha="right",
        va="top",
        bbox=dict(boxstyle="round", facecolor="white", alpha=0.7),
        fontsize=11,
    )

    ax.set_title("Group Distributions for One-way ANOVA", fontsize=14)
    ax.set_xlabel(numeric_col, fontsize=12)
    ax.set_ylabel("Density", fontsize=12)
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.legend(title=cat_col)
    plt.tight_layout()

    return fig


def one_way_anova(
    data_group: pd.DataFrame,
    *,
    numeric_col: str,
    cat_col: str,
) -> tuple[pd.DataFrame, plt.Figure]:
    """
    One-way ANOVA (pingouin.anova) + distribution plot.
    """
    if data_group.empty:
        raise ValueError("Dataset is empty after filtering.")

    df_output = pg.anova(
        dv=numeric_col,
        between=cat_col,
        data=data_group,
        detailed=True,
    )

    fig = one_way_anova_plot(
        data_group=data_group,
        numeric_col=numeric_col,
        cat_col=cat_col,
        df_output=df_output,
    )

    return df_output, fig

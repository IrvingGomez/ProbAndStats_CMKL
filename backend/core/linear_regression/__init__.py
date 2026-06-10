from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import statsmodels.api as sm
import statsmodels.formula.api as smf
from matplotlib.figure import Figure


def plot_simple_regression(
    *,
    data: pd.DataFrame,
    x: str,
    y: str,
    intercept: bool,
    use_formula: bool,
    formula_latex: str,
    model: sm.regression.linear_model.RegressionResultsWrapper,
    alpha: float,
    show_ci: bool,
    show_pi: bool,
    fit_to_obs: bool,
    x_vector: Optional[Sequence[float]],
) -> Figure:
    """
    Replicates the behaviour of PlotSimpleRegression in the monolith.

    Parameters
    ----------
    data:
        DataFrame containing at least the columns `x` and `y` (after dropping NaNs).
    x, y:
        Names of the predictor and response.
    intercept:
        Whether an explicit intercept column was included when fitting the model
        (ignored if `use_formula` is True, since the formula controls the intercept).
    use_formula:
        Whether the model was fit via a formula.
    formula_latex:
        Optional LaTeX representation of the model, used for the title.
    model:
        Fitted statsmodels OLS / OLS-like result.
    alpha:
        Significance level used for confidence / prediction intervals (e.g. 0.05).
    show_ci, show_pi:
        Whether to plot confidence / prediction intervals.
    fit_to_obs:
        If True, predictions are evaluated on the observed X values (sorted).
        Otherwise, predictions are evaluated on `x_vector`, which must be
        a 1-D sequence of x values.
    x_vector:
        Grid of x values to use when `fit_to_obs` is False.

    Returns
    -------
    matplotlib.figure.Figure
    """
    # Prepare prediction input
    if fit_to_obs:
        work = data[[x, y]].dropna().copy().sort_values(x).reset_index(drop=True)
        x_plot = work[x].to_numpy()
        X_pred = work[[x]]
    else:
        if x_vector is None:
            raise ValueError("x_vector must be provided when 'fit_to_obs' is False.")
        x_arr = np.asarray(x_vector)
        x_plot = x_arr
        X_pred = pd.DataFrame({x: x_arr})

    # Add intercept if needed (only relevant for non-formula fits)
    if not use_formula and intercept:
        X_pred = sm.add_constant(X_pred)

    # Get prediction intervals from statsmodels
    pred_table = model.get_prediction(X_pred).summary_frame(alpha=alpha)

    # --- Plotting ---
    plt.style.use("seaborn-v0_8-whitegrid")
    fig, ax = plt.subplots(figsize=(8, 5.5))

    # Scatter plot of data
    sns.scatterplot(
        data=data,
        x=x,
        y=y,
        ax=ax,
        s=50,
        edgecolor="black",
        linewidth=0.5,
        zorder=3,
        label="Data",
        alpha=0.5,
    )

    # Regression line
    ax.plot(x_plot, pred_table["mean"], color="royalblue", linewidth=2, label="Prediction")

    # Confidence interval for mean
    if show_ci:
        ax.fill_between(
            x_plot,
            pred_table["mean_ci_lower"],
            pred_table["mean_ci_upper"],
            color="pink",
            alpha=0.5,
            label="Confidence Interval (mean)",
        )

    # Prediction interval for new observations
    if show_pi:
        ax.fill_between(
            x_plot,
            pred_table["obs_ci_lower"],
            pred_table["obs_ci_upper"],
            color="mediumpurple",
            alpha=0.4,
            label="Prediction Interval (new obs)",
        )

    # Highlight extrapolation region when using x_vector
    if not fit_to_obs:
        xmin, xmax = data[x].min(), data[x].max()
        ax.axvspan(x_plot[0], xmin, color="gray", alpha=0.1)
        ax.axvspan(xmax, x_plot[-1], color="gray", alpha=0.1)

    # Title
    if use_formula and formula_latex:
        ax.set_title(f"Linear Regression: ${formula_latex}$", fontsize=14)
    else:
        ax.set_title(f"Linear Regression: {y} ~ {x}", fontsize=14)

    # R-squared annotation
    r2 = getattr(model, "rsquared", None)
    if r2 is not None:
        ax.text(
            0.05,
            0.95,
            f"$R^2 = {r2:.3f}$",
            transform=ax.transAxes,
            ha="left",
            va="top",
            fontsize=11,
            bbox=dict(boxstyle="round", facecolor="white", alpha=0.8),
        )

    ax.set_xlabel(x, fontsize=12)
    ax.set_ylabel(y, fontsize=12)

    # Deduplicate legend entries
    handles, labels = ax.get_legend_handles_labels()
    by_label = dict(zip(labels, handles))
    ax.legend(by_label.values(), by_label.keys(), frameon=False)

    ax.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()

    return fig


def plot_observed_vs_predicted(
    *,
    data: pd.DataFrame,
    y: str,
    model: sm.regression.linear_model.RegressionResultsWrapper,
    alpha: float = 0.05,
) -> Figure:
    """
    Replicates PlotCompareYHatY from the monolith.
    """
    plt.style.use("seaborn-v0_8-whitegrid")

    pred_table = model.get_prediction().summary_frame(alpha=alpha)
    y_true = data[y]
    y_pred = pred_table["mean"]
    y_err = pred_table["obs_ci_upper"] - y_pred

    residuals = y_true - y_pred

    fig, ax = plt.subplots(figsize=(7.5, 5.5))

    # Scatter of observed vs predicted, coloured by |residual|
    sc = ax.scatter(
        y_true,
        y_pred,
        c=np.abs(residuals),
        cmap="Reds",
        edgecolor="black",
        alpha=0.6,
        s=60,
        label="Predicted vs Observed",
        zorder=3,
    )

    # Error bars using prediction interval width
    ax.errorbar(
        y_true,
        y_pred,
        yerr=y_err,
        fmt="none",
        ecolor="gray",
        elinewidth=1,
        alpha=0.4,
        capsize=3,
        zorder=1,
    )

    # Reference 45° line
    min_val = min(y_true.min(), y_pred.min())
    max_val = max(y_true.max(), y_pred.max())
    buffer = 0.05 * (max_val - min_val)
    ax.plot(
        [min_val, max_val],
        [min_val, max_val],
        "r--",
        label="Perfect Fit",
        zorder=2,
    )
    ax.set_xlim(min_val - buffer, max_val + buffer)
    ax.set_ylim(min_val - buffer, max_val + buffer)

    ax.set_title("Observed vs Predicted", fontsize=14)
    ax.set_xlabel(f"Observed {y}", fontsize=12)
    ax.set_ylabel(f"Predicted {y}", fontsize=12)

    r2 = getattr(model, "rsquared", None)
    if r2 is not None:
        ax.text(
            0.05,
            0.95,
            f"$R^2 = {r2:.3f}$",
            transform=ax.transAxes,
            ha="left",
            va="top",
            fontsize=11,
            bbox=dict(boxstyle="round", facecolor="white", alpha=0.7),
        )

    cbar = plt.colorbar(sc, ax=ax)
    cbar.set_label("|Residual|", rotation=270, labelpad=15)

    handles, labels = ax.get_legend_handles_labels()
    ax.legend(handles, labels, frameon=False)
    ax.grid(True, linestyle="--", alpha=0.3)
    plt.tight_layout()

    return fig


def run_linear_regression(
    *,
    df: pd.DataFrame,
    formula_check: bool,
    formula_text: str,
    formula_latex: str,
    dependent_var: str,
    independent_vars: Sequence[str],
    alpha: float,
    intercept: bool,
    create_graph: bool,
    graph_type: str,
    show_ci: bool,
    show_pi: bool,
    fit_to_obs: bool,
    x_vector: Optional[Sequence[float]],
) -> Tuple[str, pd.DataFrame, Optional[Figure]]:
    """
    Fit a linear regression model and optionally create a diagnostic plot.

    This is a stats-only function: it does not depend on Gradio or any UI
    objects. It mirrors the behaviour of the monolithic `linear_regression`
    function, but leaves error handling and rounding to the caller.

    Returns
    -------
    summary_html:
        HTML representation of statsmodels' summary2 table.
    params_table:
        Coefficient table (second table from summary2) as a DataFrame
        with a 'Variable' column (unrounded).
    fig:
        Matplotlib figure for the requested graph, or None if
        create_graph is False.
    """
    if df is None or df.empty:
        raise ValueError("No dataset loaded.")

    if dependent_var not in df.columns:
        raise ValueError("Invalid dependent variable selection.")

    for col in independent_vars:
        if col not in df.columns:
            raise ValueError(f"Invalid independent variable: {col!r}")

    if len(independent_vars) == 0:
        raise ValueError("At least one independent variable is required.")

    # Drop rows with missing values in the relevant columns
    cols = [dependent_var] + list(independent_vars)
    data = df[cols].dropna()

    if data.empty:
        raise ValueError("No valid rows remaining after dropping missing values.")

    y = data[dependent_var]
    X = data[list(independent_vars)]

    # Fit model
    if formula_check:
        # When using a formula, the intercept is fully controlled by the formula.
        if not formula_text:
            raise ValueError("Formula is enabled but no formula text was provided.")
        model = smf.ols(data=data, formula=formula_text).fit()
        use_formula = True
    else:
        if intercept:
            X = sm.add_constant(X)
        model = sm.OLS(y, X).fit()
        use_formula = False

    # Build summary objects
    summary = model.summary2(alpha=alpha)
    summary_html = summary.as_html()

    # Coefficient table is the second table in summary2
    params_table = summary.tables[1].reset_index().rename(columns={"index": "Variable"})

    fig: Optional[Figure] = None

    if create_graph:
        if graph_type == "Simple Regression":
            if len(independent_vars) != 1:
                raise ValueError(
                    "Simple Regression graph is only available with exactly one "
                    "independent variable."
                )

            x_col = independent_vars[0]
            fig = plot_simple_regression(
                data=data,
                x=x_col,
                y=dependent_var,
                intercept=intercept,
                use_formula=use_formula,
                formula_latex=formula_latex,
                model=model,
                alpha=alpha,
                show_ci=show_ci,
                show_pi=show_pi,
                fit_to_obs=fit_to_obs,
                x_vector=x_vector,
            )
        elif graph_type == "Observed vs Predicted":
            fig = plot_observed_vs_predicted(
                data=data,
                y=dependent_var,
                model=model,
                alpha=alpha,
            )
        else:
            raise ValueError(f"Unknown graph type: {graph_type!r}")

    return summary_html, params_table, fig

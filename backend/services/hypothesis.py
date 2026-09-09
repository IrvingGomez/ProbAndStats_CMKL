"""Orchestration for the Hypothesis Testing tab.

Materializes groups from the session dataframe, dispatches to the four tests in
``core.hypothesis_testing``, then asks ``core.hypothesis_testing.rejection_region``
for the decision layer the original Gradio app has no equivalent of: a
significance level, critical values, and an explicit verdict.

No numpy / scipy / matplotlib imports here — this layer only maps schemas.
"""

from typing import Any, Dict, List, Optional

import pandas as pd

from api.schemas.hypothesis import (
    EQUAL_VARIANCE,
    ONE_SAMPLE_T,
    ONE_WAY_ANOVA,
    TWO_SAMPLE_T,
    GroupSpec,
    HypothesisParams,
)
from core.hypothesis_testing import one_sample_ttest, two_sample_ttest, variance_test
from core.hypothesis_testing.rejection_region import compute_rejection_region_data
from core.hypothesis_testing.tables import anova_table

# The tests are called with plotting off: the frontend draws Plotly from JSON, and
# the bundled matplotlib helpers read pingouin's pre-0.6 column names anyway.
_NO_GRAPH = dict(include_graph=False, bootstrap_samples=0)

# pingouin renamed its hyphenated result columns in 0.6 (p-val -> p_val,
# p-unc -> p_unc). The professor's app pins 0.5.5, this backend runs 0.6.x, so
# every read goes through _cell and accepts either spelling.
_P_TTEST = ("p-val", "p_val")
_P_ANOVA = ("p-unc", "p_unc")

_ALTERNATIVE_SYMBOL = {"two-sided": "≠", "greater": ">", "less": "<"}


def _cell(table: pd.DataFrame, *aliases: str, row: int = 0):
    for name in aliases:
        if name in table.columns:
            return table[name].iloc[row]
    raise ValueError(f"Expected one of {aliases} in the result table.")


def _materialize_group(df: pd.DataFrame, numeric_col: str, spec: Optional[GroupSpec]) -> pd.Series:
    """Rows whose category is any of the selected values, as a numeric series.

    Returns a Series rather than an array so the index survives — that is what
    lets the caller notice two groups sharing rows.
    """
    if spec is None or not spec.column:
        raise ValueError("No categorical column selected.")
    if spec.column not in df.columns:
        raise ValueError(f"Categorical column '{spec.column}' not found in the dataset.")

    values = list(spec.values or [])
    if not values:
        raise ValueError(f"No categories selected for column '{spec.column}'.")

    cat_series = pd.Series(values).astype(df[spec.column].dtype)
    series = df.loc[df[spec.column].isin(cat_series), numeric_col].dropna()
    if series.empty:
        raise ValueError("One or more groups are empty after filtering.")
    return series


def _materialize_anova_frame(
    df: pd.DataFrame, numeric_col: str, cat_col: Optional[str], levels: Optional[List[str]]
) -> pd.DataFrame:
    """Long-format two-column frame that ``pingouin.anova`` expects."""
    if not cat_col:
        raise ValueError("A categorical column must be selected for ANOVA.")
    if cat_col not in df.columns:
        raise ValueError(f"Categorical column '{cat_col}' not found in the dataset.")

    selected = list(levels or [])
    if not selected:
        raise ValueError(f"No categories selected for column '{cat_col}'.")

    cat_series = pd.Series(selected).astype(df[cat_col].dtype)
    frame = df[df[cat_col].isin(cat_series)][[numeric_col, cat_col]].dropna()
    if frame.empty:
        raise ValueError("One or more groups are empty after filtering.")
    if frame[cat_col].nunique() < 2:
        raise ValueError("At least two categories must be selected for ANOVA.")
    return frame


def _summary(name: str, series: pd.Series) -> Dict[str, Any]:
    return {
        "name": name,
        "n": int(series.size),
        "mean": float(series.mean()),
        "sd": float(series.std(ddof=1)),
        "var": float(series.var(ddof=1)),
    }


def _overlap_warning(g1: pd.Series, g2: pd.Series) -> List[str]:
    shared = len(g1.index.intersection(g2.index))
    if not shared:
        return []
    return [
        f"{shared} row(s) appear in both groups. A two-sample test assumes the groups "
        "are independent, so treat this result with care."
    ]


# ── the four tests ────────────────────────────────────────────────────────────

def _run_one_sample(df: pd.DataFrame, params: HypothesisParams) -> Dict[str, Any]:
    if params.mu0 is None:
        raise ValueError("μ₀ must be specified for the one-sample t-test.")

    sample = df[params.column].dropna()
    if sample.empty:
        raise ValueError("No valid data in the selected column.")

    table, _ = one_sample_ttest(
        sample.to_numpy(),
        float(params.mu0),
        params.alternative,
        numeric_col=params.column,
        **_NO_GRAPH,
    )
    mu0 = float(params.mu0)
    return {
        "table": table,
        "statistic": float(_cell(table, "T")),
        "p_value": float(_cell(table, *_P_TTEST)),
        "dist": "t",
        "dof": (float(_cell(table, "dof")),),
        "h0": f"μ = {mu0:g}",
        "h1": f"μ {_ALTERNATIVE_SYMBOL[params.alternative]} {mu0:g}",
        "group_summary": [_summary(params.column, sample)],
        "warnings": [],
    }


def _run_two_sample(df: pd.DataFrame, params: HypothesisParams) -> Dict[str, Any]:
    g1 = _materialize_group(df, params.column, params.group1)
    g2 = _materialize_group(df, params.column, params.group2)
    name1 = params.group1.name or "Group 1"
    name2 = params.group2.name or "Group 2"

    table, _ = two_sample_ttest(
        g1.to_numpy(),
        g2.to_numpy(),
        numeric_col=params.column,
        name_group1=name1,
        name_group2=name2,
        alternative=params.alternative,
        correction=params.correction,
        plot_type="Mean Density",
        **_NO_GRAPH,
    )
    symbol = _ALTERNATIVE_SYMBOL[params.alternative]
    return {
        "table": table,
        "statistic": float(_cell(table, "T")),
        "p_value": float(_cell(table, *_P_TTEST)),
        "dist": "t",
        "dof": (float(_cell(table, "dof")),),
        "h0": f"μ({name1}) = μ({name2})",
        "h1": f"μ({name1}) {symbol} μ({name2})",
        "group_summary": [_summary(name1, g1), _summary(name2, g2)],
        "warnings": _overlap_warning(g1, g2),
    }


def _run_variance(df: pd.DataFrame, params: HypothesisParams) -> Dict[str, Any]:
    g1 = _materialize_group(df, params.column, params.group1)
    g2 = _materialize_group(df, params.column, params.group2)
    name1 = params.group1.name or "Group 1"
    name2 = params.group2.name or "Group 2"

    table, _ = variance_test(
        g1.to_numpy(),
        g2.to_numpy(),
        name_group1=name1,
        name_group2=name2,
        test_type=params.variance_test_type,
        **_NO_GRAPH,
    )

    # Bartlett's statistic is chi-square with k-1 df; Levene's is F(k-1, N-k).
    # scipy returns neither, so both are derived from the group sizes (k = 2 here).
    if params.variance_test_type == "Bartlett":
        dist, dof = "chi2", (1.0,)
    else:
        dist, dof = "f", (1.0, float(g1.size + g2.size - 2))

    return {
        "table": table,
        "statistic": float(_cell(table, "Statistic")),
        "p_value": float(_cell(table, "p-value")),
        "dist": dist,
        "dof": dof,
        "h0": f"σ²({name1}) = σ²({name2})",
        "h1": f"σ²({name1}) ≠ σ²({name2})",
        "group_summary": [_summary(name1, g1), _summary(name2, g2)],
        "warnings": _overlap_warning(g1, g2),
    }


def _run_anova(df: pd.DataFrame, params: HypothesisParams) -> Dict[str, Any]:
    frame = _materialize_anova_frame(
        df, params.column, params.anova_column, params.anova_levels
    )
    cat_col = params.anova_column
    table = anova_table(frame, numeric_col=params.column, cat_col=cat_col)

    # Row 0 is the factor, row 1 is "Within" — its F and p are NaN, which is how
    # the denominator degrees of freedom are identified.
    dof = (float(_cell(table, "DF", row=0)), float(_cell(table, "DF", row=1)))

    groups = [
        _summary(str(level), sub[params.column])
        for level, sub in frame.groupby(cat_col, observed=True)
    ]

    return {
        "table": table,
        "statistic": float(_cell(table, "F")),
        "p_value": float(_cell(table, *_P_ANOVA)),
        "dist": "f",
        "dof": dof,
        "h0": "all group means are equal",
        "h1": "at least one group mean differs",
        "group_summary": groups,
        "warnings": [],
    }


_DISPATCH = {
    ONE_SAMPLE_T: _run_one_sample,
    TWO_SAMPLE_T: _run_two_sample,
    EQUAL_VARIANCE: _run_variance,
    ONE_WAY_ANOVA: _run_anova,
}


def run_hypothesis_test(df: pd.DataFrame, params: HypothesisParams) -> Dict[str, Any]:
    if params.column not in df.columns:
        raise ValueError(f"Column '{params.column}' not found in the dataset.")

    run = _DISPATCH.get(params.test_type)
    if run is None:
        raise ValueError(f"Unknown hypothesis test: {params.test_type}")

    outcome = run(df, params)

    # Bartlett, Levene and ANOVA reject in the upper tail whatever the
    # alternative-hypothesis radio last held; resolve_tail enforces that and the
    # effective tail comes back in the region payload.
    region = compute_rejection_region_data(
        dist=outcome["dist"],
        dof=outcome["dof"],
        statistic=outcome["statistic"],
        p_value=outcome["p_value"],
        alpha=params.alpha,
        tail=params.alternative,
    )

    return {
        "test_type": params.test_type,
        "table": outcome["table"].to_json(orient="records"),
        "statistic": outcome["statistic"],
        "p_value": outcome["p_value"],
        "alpha": params.alpha,
        "reject": region["reject"],
        "verdict": "Reject H₀" if region["reject"] else "Fail to reject H₀",
        "h0": outcome["h0"],
        "h1": outcome["h1"],
        "rejection_region": region,
        "group_summary": outcome["group_summary"],
        "warnings": outcome["warnings"],
    }

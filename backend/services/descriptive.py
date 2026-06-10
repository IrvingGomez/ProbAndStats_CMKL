import pandas as pd
from typing import List

from core.estimation.descriptive import (
    compute_descriptive_statistics,
    compute_histogram,
    compute_boxplot_data,
)
from api.schemas.descriptive import (
    DescriptiveRequest,
    DescriptiveResponse,
    StatRow,
    DescriptiveSummary,
    HistogramData,
    BoxData,
)

def build_histogram(series: pd.Series) -> HistogramData:
    data = compute_histogram(series)
    return HistogramData(binEdges=data["binEdges"], counts=data["counts"])

def _advanced_id(measure: str) -> str | None:
    """Map a core measure name to the frontend advancedId, or None for basic stats."""
    if measure.startswith("Trimmed Mean"):
        return "trimmed_mean"
    if measure.startswith("Winsorized Mean"):
        return "winsorized_mean"
    return {
        "Interquartile Mean": "iqm",
        "Weighted Mean":      "weighted_mean",
        "Geometric Mean":     "geometric_mean",
        "Harmonic Mean":      "harmonic_mean",
        "Variance (ddof=0)":  "variance_0",
        "Variance (ddof=1)":  "variance_1",
        "Std (ddof=0)":       "std_dev_0",
        "IQR":                "iqr",
        "Range":              "range",
        "MAD":                "mad",
        "AAD":                "aad",
        "Skewness (k-statistic)":     "skewness",
        "Kurtosis (k-statistic)":            "kurtosis",
    }.get(measure)


def calculate_descriptive(df: pd.DataFrame, req: DescriptiveRequest) -> DescriptiveResponse:
    if req.column not in df.columns:
        raise ValueError(f"Column '{req.column}' not found in dataset")
        
    # Apply client-side filters to match frontend view
    if req.filters:
        for col, allowed_values in req.filters.items():
            if col in df.columns and allowed_values:
                # Need to gracefully handle float/int/string matches 
                # e.g., if allowed is ["1"], but df[col] is 1.0
                df_col_str = df[col].astype(str)
                # also try to strip trailing '.0' for numeric parity
                df_col_cleaned = df_col_str.str.replace(r'\.0$', '', regex=True)
                df = df[df_col_str.isin(allowed_values) | df_col_cleaned.isin(allowed_values)]

    series = df[req.column].dropna()
    weights = df[req.weightsCol].dropna() if req.weightsCol else None
    
    if len(series) < 2:
        raise ValueError(f"Not enough data points ({len(series)}) for column '{req.column}' after filtering.")
    
    # 1. Run core stats computation
    stats_df = compute_descriptive_statistics(
        series,
        quantile_probs=req.quantileProbs,
        trim_alpha=req.trimAlpha,
        winsor_limits=req.winsorLimits,
        weights=weights
    )
    
    # Map the DataFrame rows back to our StatRow schema
    rows: List[StatRow] = []
    
    # Map core names to frontend categories
    cat_map = {
        "Quantiles": "Quantiles",
        "Central Tendency": "Central Tendency",
        "Dispersion": "Dispersion",
        "Shape": "Shape"
    }

    # Add extremes explicitly since core/ may not add min/max
    _min, _max = series.min(), series.max()
    rows.append(StatRow(category="Extremes", measure="Minimum", value=_min, consistencyCorr=None, robust=False))
    rows.append(StatRow(category="Extremes", measure="Maximum", value=_max, consistencyCorr=None, robust=False))
    
    for _, row in stats_df.iterrows():
        cat = cat_map.get(row["Statistic Type"], "Central Tendency")
        val = None if pd.isna(row["Value"]) else float(row["Value"])
        corr = None if pd.isna(row["Bias Corrected"]) else float(row["Bias Corrected"])
        
        rows.append(StatRow(
            category=cat, # type: ignore
            measure=str(row["Measure"]),
            value=val,
            consistencyCorr=corr,
            robust=bool(row["Robust"]),
            advancedId=_advanced_id(str(row["Measure"]))
        ))
        
    # 2. Build Summary
    summary = DescriptiveSummary(
        n=len(series),
        mean=float(series.mean()),
        median=float(series.median()),
        std=float(series.std(ddof=1)),
        iqr=float(series.quantile(0.75) - series.quantile(0.25))
    )
    
    # 3. Build Histogram
    histogram = build_histogram(series)
    
    # 4. Build BoxData
    box = compute_boxplot_data(series)
    boxData = BoxData(**box)
    
    return DescriptiveResponse(
        rows=rows,
        summary=summary,
        histogram=histogram,
        boxData=boxData
    )


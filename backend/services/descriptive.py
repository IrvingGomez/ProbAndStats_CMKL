import numpy as np
import pandas as pd
from typing import Dict, Any, List

from core.estimation.descriptive import compute_descriptive_statistics
from api.schemas.descriptive import (
    DescriptiveRequest, 
    DescriptiveResponse, 
    StatRow, 
    DescriptiveSummary,
    HistogramData,
    BoxData
)

def build_histogram(series: pd.Series) -> HistogramData:
    n = len(series)
    if n < 2:
        return HistogramData(binEdges=[], counts=[])

    q1v = series.quantile(0.25)
    q3v = series.quantile(0.75)
    iqrV = q3v - q1v
    dataRange = series.max() - series.min()

    if iqrV == 0:
        numBins = int(min(30, np.ceil(np.sqrt(n))))
    else:
        binWidth = 2 * (iqrV / np.cbrt(n))
        numBins = int(min(50, max(5, np.ceil(dataRange / binWidth))))

    counts, bin_edges = np.histogram(series, bins=numBins)
    return HistogramData(
        binEdges=bin_edges.tolist(),
        counts=counts.tolist()
    )

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
    q1 = float(series.quantile(0.25))
    med = float(series.median())
    q3 = float(series.quantile(0.75))
    iqr = q3 - q1
    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr
    
    outliers = series[(series < lower_fence) | (series > upper_fence)].tolist()
    
    # Whiskers
    whisker_lo = float(series[series >= lower_fence].min()) if not series[series >= lower_fence].empty else _min
    whisker_hi = float(series[series <= upper_fence].max()) if not series[series <= upper_fence].empty else _max

    boxData = BoxData(
        min=whisker_lo,
        q1=q1,
        median=med,
        q3=q3,
        max=whisker_hi,
        outliers=outliers
    )
    
    return DescriptiveResponse(
        rows=rows,
        summary=summary,
        histogram=histogram,
        boxData=boxData
    )


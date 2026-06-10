import pandas as pd
import pytest
from services.descriptive import calculate_descriptive, build_histogram
from api.schemas.descriptive import DescriptiveRequest

def test_calculate_descriptive_basic():
    df = pd.DataFrame({"Score": [10, 20, 20, 30, 40, 50]})
    req = DescriptiveRequest(
        session_id="dummy",
        column="Score"
    )
    
    res = calculate_descriptive(df, req)
    
    assert res.summary.n == 6
    assert res.summary.mean == 28.333333333333332
    assert res.summary.median == 25.0
    
    # Check rows mapped correctly
    assert len(res.rows) > 10
    
    # Check quantiles included
    quantiles = [r for r in res.rows if r.category == 'Quantiles']
    assert len(quantiles) == 3 # 0.25, 0.5, 0.75
    
    # Check Box Data — whiskers are exact fence values: Q1-1.5*IQR, Q3+1.5*IQR
    # Dataset: Q1=20, Q3=37.5 (pandas linear interp), IQR=17.5 → fences: -6.25 / 63.75
    assert res.boxData.whiskerLo == pytest.approx(-6.25)
    assert res.boxData.whiskerHi == pytest.approx(63.75)
    assert len(res.boxData.outliers) == 0

def test_build_histogram():
    series = pd.Series([1, 2, 2, 3, 3, 3, 4, 4, 5])
    hist = build_histogram(series)
    
    assert len(hist.binEdges) > 1
    assert len(hist.counts) == len(hist.binEdges) - 1
    assert sum(hist.counts) == 9

"""Service-level parity tests for Graphical Analysis.

Numbers are checked against the same core helpers the Gradio original calls, so
a drift in the JSON layer shows up here rather than in the UI.
"""

import math

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

from api.schemas.graphical import GraphicalParams
from api.schemas.inference import InferenceParams
from core.estimation.inference.estimators import estimate_mean, estimate_sigma
from services.graphical import compute_graphical_data
from services.inference import calculate_intervals

RNG = np.random.default_rng(20260909)
VALUES = np.round(RNG.normal(loc=30.0, scale=8.0, size=60), 4)
WEIGHTS = np.abs(RNG.normal(loc=5.0, scale=1.0, size=60))


@pytest.fixture
def df():
    return pd.DataFrame({
        "Age": VALUES,
        "Weight": WEIGHTS,
        "City": ["A" if i % 2 else "B" for i in range(60)],
    })


def params(**kwargs) -> GraphicalParams:
    return GraphicalParams(column="Age", **kwargs)


# -- ECDF --------------------------------------------------------------------

def test_ecdf_drops_the_non_serializable_leading_point(df):
    res = compute_graphical_data(df, params(graph_type="ECDF"))
    xs = res["ecdf_data"]["x"]
    assert all(math.isfinite(x) for x in xs)
    assert xs[0] == pytest.approx(float(VALUES.min()))


def test_dkw_epsilon_follows_the_confidence_level(df):
    n = len(VALUES)
    for level in (0.95, 0.90):
        res = compute_graphical_data(
            df, params(graph_type="ECDF", ecdf_conf_level=level)
        )
        expected = math.sqrt(math.log(2.0 / (1.0 - level)) / (2.0 * n))
        assert res["ecdf_data"]["epsilon"] == pytest.approx(expected)

    tight = compute_graphical_data(df, params(graph_type="ECDF", ecdf_conf_level=0.90))
    wide = compute_graphical_data(df, params(graph_type="ECDF", ecdf_conf_level=0.95))
    assert tight["ecdf_data"]["epsilon"] < wide["ecdf_data"]["epsilon"]


def test_ecdf_band_omitted_when_switched_off(df):
    res = compute_graphical_data(df, params(graph_type="ECDF", add_conf_band=False))
    assert res["ecdf_data"].get("lower") is None
    assert res["ecdf_data"].get("upper") is None


# -- Normal overlay ----------------------------------------------------------

def test_normal_overlay_honours_the_selected_estimators(df):
    res = compute_graphical_data(df, params(
        add_normal=True,
        mean_estimator="Interquartile Mean",
        sigma_estimator="MAD (bias corrected)",
    ))

    expected_mu = float(estimate_mean(pd.Series(VALUES), "Interquartile Mean"))
    expected_sigma = float(estimate_sigma(pd.Series(VALUES), "MAD (bias corrected)"))

    assert res["point_estimates"]["mu"] == pytest.approx(expected_mu)
    assert res["point_estimates"]["sigma"] == pytest.approx(expected_sigma)
    assert res["normal_curve"]["mu"] == pytest.approx(expected_mu)

    # Grid is hat_mu +/- 3 sigma, matching the matplotlib overlay.
    xs = res["normal_curve"]["x"]
    assert len(xs) == 200
    assert xs[0] == pytest.approx(expected_mu - 3 * expected_sigma)
    assert xs[-1] == pytest.approx(expected_mu + 3 * expected_sigma)


def test_normal_overlay_can_centre_on_the_median(df):
    res = compute_graphical_data(df, params(
        add_normal=True, normal_mu_source="Median-based CI"
    ))
    assert res["point_estimates"]["mu"] == pytest.approx(float(np.median(VALUES)))


# -- CI / PI bands -----------------------------------------------------------

def _reference_intervals(alpha=0.05, **overrides):
    inf = InferenceParams(session_id="x", column="Age", alpha=alpha, **overrides)
    return calculate_intervals(pd.Series(VALUES), inf)


def test_ci_endpoints_match_the_shared_interval_service(df):
    res = compute_graphical_data(df, params(add_ci=True, ci_choice="Both"))
    _, _, mean_ci, _, median_ci, _ = _reference_intervals()

    bands = {b["kind"]: b for b in res["interval_bands"]}
    assert bands["ci_mean"]["low"] == pytest.approx(float(mean_ci[0]))
    assert bands["ci_mean"]["high"] == pytest.approx(float(mean_ci[1]))
    assert bands["ci_median"]["low"] == pytest.approx(float(median_ci[0]))
    assert bands["ci_median"]["high"] == pytest.approx(float(median_ci[1]))


def test_ci_choice_suppresses_the_other_band(df):
    res = compute_graphical_data(df, params(add_ci=True, ci_choice="Mean"))
    kinds = {b["kind"] for b in res["interval_bands"]}
    assert kinds == {"ci_mean"}


def test_pi_endpoints_match_the_shared_interval_service(df):
    res = compute_graphical_data(df, params(add_pi=True, pi_choice="IQR"))
    _, pi_table, _, _, _, _ = _reference_intervals()
    row = pi_table[pi_table["Statistic"] == "IQR"].iloc[0]

    band = [b for b in res["interval_bands"] if b["kind"] == "pi"][0]
    assert band["low"] == pytest.approx(float(row["Lower"]))
    assert band["high"] == pytest.approx(float(row["Upper"]))


def test_bootstrap_pi_requires_the_bootstrap_toggle(df):
    with pytest.raises(ValueError, match="Bootstrap Prediction"):
        compute_graphical_data(df, params(add_pi=True, pi_choice="Bootstrap"))

    res = compute_graphical_data(df, params(
        add_pi=True, pi_choice="Bootstrap", bootstrap_pi=True, bootstrap_samples=200
    ))
    assert any(b["kind"] == "pi" for b in res["interval_bands"])


def test_confidence_level_is_validated(df):
    # Bounds now live on the schema, so an out-of-range level never reaches the
    # service. See test_graphical_edge_cases.TestParameterBounds for the sweep.
    with pytest.raises(ValidationError):
        params(add_ci=True, conf_level=1.5)


def test_range_estimator_rejected_above_25_observations(df):
    with pytest.raises(ValueError, match="Range-based"):
        compute_graphical_data(df, params(
            add_normal=True, sigma_estimator="Range (bias corrected)"
        ))


# -- Histogram / PMF / rug ---------------------------------------------------

def test_histogram_bin_count_is_controllable(df):
    auto = compute_graphical_data(df, params())
    fixed = compute_graphical_data(df, params(bins=12))
    assert len(fixed["histogram_data"]["counts"]) == 12
    assert len(auto["histogram_data"]["counts"]) == len(auto["histogram_data"]["bins"]) - 1


def test_rug_data_only_when_requested(df):
    assert "rug_data" not in compute_graphical_data(df, params())
    res = compute_graphical_data(df, params(add_data=True))
    assert res["rug_data"]["n_total"] == len(VALUES)


def test_pmf_warns_on_a_near_continuous_column(df):
    res = compute_graphical_data(df, params(graph_type="PMF"))
    assert any("empirical PMF" in w for w in res["warnings"])


def test_unknown_graph_type_is_rejected():
    with pytest.raises(Exception):
        GraphicalParams(column="Age", graph_type="Empirical Probability Mass Function")


# -- Weights -----------------------------------------------------------------

def test_weights_column_aligns_with_the_data(df):
    res = compute_graphical_data(df, params(
        add_normal=True, mean_estimator="Weighted Mean", weights_column="Weight"
    ))
    expected = float(estimate_mean(df["Age"], "Weighted Mean", weights=df["Weight"]))
    assert res["point_estimates"]["mu"] == pytest.approx(expected)

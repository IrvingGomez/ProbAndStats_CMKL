"""Edge cases for Graphical Analysis: degenerate samples, stale weights and
overlays that are not comparable on the chosen axis.

Every response here is round-tripped through ``json.dumps(allow_nan=False)``,
which is exactly what Starlette does when rendering. A NaN or infinity that
reaches the schema is a 500 at the API, so the assertion belongs in the tests
rather than in a manual check.
"""

import json

import numpy as np
import pandas as pd
import pytest

from api.schemas.graphical import GraphicalParams
from core.estimation import graphical_json as gj
from core.estimation.graphical_json import DegenerateDataError
from services.graphical import compute_graphical_data, resolve_weights_column


def params(**kwargs) -> GraphicalParams:
    return GraphicalParams(column="X", **kwargs)


def serializable(result) -> bool:
    json.dumps(result, allow_nan=False)
    return True


@pytest.fixture
def constant():
    """Thirty identical readings — a stuck sensor, in lab terms."""
    return pd.DataFrame({"X": [5.0] * 30})


@pytest.fixture
def spread():
    return pd.DataFrame({"X": np.linspace(1.0, 20.0, 40)})


# -- Constant data -----------------------------------------------------------

class TestConstantSample:
    def test_histogram_still_renders(self, constant):
        res = compute_graphical_data(constant, params(add_kde=False))
        assert serializable(res)
        assert res["histogram_data"]["counts"] == [30]

    def test_kde_is_skipped_with_an_explanation(self, constant):
        # A Gaussian KDE on zero spread is a ~1e14 spike that erases the plot.
        res = compute_graphical_data(constant, params(add_kde=True))
        assert serializable(res)
        assert "kde_curve" not in res
        assert any("KDE not drawn" in w for w in res["warnings"])

    def test_normal_overlay_is_skipped_with_an_explanation(self, constant):
        res = compute_graphical_data(constant, params(add_normal=True))
        assert serializable(res)
        assert "normal_curve" not in res
        assert any("Normal overlay not drawn" in w for w in res["warnings"])

    def test_undefined_intervals_are_dropped_not_emitted_as_nan(self, constant):
        # Regression: these came back NaN and failed the whole response.
        res = compute_graphical_data(constant, params(add_ci=True, add_kde=False))
        assert serializable(res)
        assert res.get("interval_bands") in (None, [])
        assert any("could not be drawn" in w for w in res["warnings"])

    def test_ecdf_is_well_defined(self, constant):
        res = compute_graphical_data(constant, params(graph_type="ECDF"))
        assert serializable(res)
        assert res["ecdf_data"]["y"][-1] == pytest.approx(1.0)


# -- Tiny samples ------------------------------------------------------------

class TestTinySample:
    def test_single_observation_does_not_leak_a_scipy_error(self):
        one = pd.DataFrame({"X": [3.0]})
        res = compute_graphical_data(one, params(add_kde=True))
        assert serializable(res)
        assert "kde_curve" not in res
        assert res["summary"]["n"] == 1

    def test_two_observations_support_a_density(self):
        two = pd.DataFrame({"X": [1.0, 2.0]})
        res = compute_graphical_data(two, params(add_kde=True))
        assert serializable(res)
        assert "kde_curve" in res

    def test_empty_column_is_a_clear_error(self):
        empty = pd.DataFrame({"X": [np.nan, np.nan]})
        with pytest.raises(ValueError, match="no non-missing values"):
            compute_graphical_data(empty, params())


# -- Stale weights -----------------------------------------------------------

class TestWeightsColumn:
    @pytest.fixture
    def partial_weights(self):
        """A weights column filled in for only half the rows."""
        return pd.DataFrame({"X": np.arange(1.0, 21.0), "W": [1.0] * 10 + [np.nan] * 10})

    def test_resolve_ignores_weights_for_every_other_estimator(self):
        assert resolve_weights_column(params(weights_column="W")) is None
        assert resolve_weights_column(
            params(weights_column="W", mean_estimator="Weighted Mean")
        ) == "W"

    def test_stale_weights_do_not_shrink_the_sample(self, partial_weights):
        # Regression: aligning on the weights column halved n and moved the mean
        # even though Sample Mean does not use weights.
        res = compute_graphical_data(partial_weights, params(
            weights_column="W", add_normal=True, mean_estimator="Sample Mean"
        ))
        assert res["summary"]["n"] == 20
        assert res["point_estimates"]["mu"] == pytest.approx(10.5)
        assert any("was ignored" in w for w in res["warnings"])

    def test_weighted_mean_does_align_on_its_weights(self, partial_weights):
        res = compute_graphical_data(partial_weights, params(
            weights_column="W", add_normal=True, mean_estimator="Weighted Mean"
        ))
        assert res["summary"]["n"] == 10
        assert not any("was ignored" in w for w in res["warnings"])

    def test_weights_with_no_overlapping_rows_is_a_clear_error(self):
        df = pd.DataFrame({"X": [1.0, 2.0, np.nan], "W": [np.nan, np.nan, 3.0]})
        with pytest.raises(ValueError, match="No rows have both"):
            compute_graphical_data(df, params(
                weights_column="W", mean_estimator="Weighted Mean", add_normal=True
            ))


# -- PMF vs density ----------------------------------------------------------

class TestPmfDensityIncompatibility:
    @pytest.fixture
    def discrete(self):
        return pd.DataFrame({"X": np.repeat([1.0, 2.0, 3.0, 4.0], 25)})

    def test_density_overlays_are_refused_on_a_probability_axis(self, discrete):
        res = compute_graphical_data(
            discrete, params(graph_type="PMF", add_kde=True, add_normal=True)
        )
        assert "kde_curve" not in res
        assert "normal_curve" not in res
        assert any("not drawn on an empirical PMF" in w for w in res["warnings"])

    def test_the_same_overlays_are_fine_on_a_histogram(self, discrete):
        res = compute_graphical_data(
            discrete, params(graph_type="Histogram", add_kde=True, add_normal=True)
        )
        assert "kde_curve" in res
        assert "normal_curve" in res

    def test_intervals_still_work_on_a_pmf(self, discrete):
        res = compute_graphical_data(discrete, params(graph_type="PMF", add_ci=True))
        assert serializable(res)
        assert len(res["interval_bands"]) == 2

    def test_ecdf_reports_that_kde_does_not_apply(self, spread):
        res = compute_graphical_data(spread, params(graph_type="ECDF", add_kde=True))
        assert "kde_curve" not in res
        assert any("not drawn on the ECDF" in w for w in res["warnings"])


# -- Bounds ------------------------------------------------------------------

class TestParameterBounds:
    @pytest.mark.parametrize("field,value", [
        ("bins", 1), ("bins", 201),
        ("conf_level", 0.0), ("conf_level", 1.0),
        ("ecdf_conf_level", 1.5),
        ("trim_param", 0.5), ("trim_param", 0.0),
        ("bootstrap_samples", 99), ("bootstrap_samples", 5001),
    ])
    def test_out_of_range_values_are_rejected_by_the_schema(self, field, value):
        with pytest.raises(Exception):
            params(**{field: value})

    @pytest.mark.parametrize("field,value", [
        ("bins", 2), ("bins", 200),
        ("conf_level", 0.99), ("trim_param", 0.25),
        ("bootstrap_samples", 100), ("bootstrap_samples", 5000),
    ])
    def test_boundary_values_are_accepted(self, field, value):
        assert params(**{field: value}) is not None


# -- The JSON adapter in isolation -------------------------------------------

class TestGraphicalJson:
    def test_has_spread_detects_a_flat_sample(self):
        assert gj.has_spread(np.array([1.0, 2.0]))
        assert not gj.has_spread(np.array([1.0, 1.0]))
        assert not gj.has_spread(np.array([1.0]))

    def test_kde_refuses_a_flat_sample(self):
        with pytest.raises(DegenerateDataError, match="same value"):
            gj.compute_kde_data(np.array([2.0] * 10))

    def test_kde_refuses_a_single_point(self):
        with pytest.raises(DegenerateDataError, match="at least two"):
            gj.compute_kde_data(np.array([2.0]))

    def test_normal_overlay_refuses_zero_sigma(self):
        with pytest.raises(DegenerateDataError, match="positive deviation"):
            gj.compute_normal_density_data(np.array([1.0, 2.0]), hat_mu=1.5, hat_sigma=0.0)

    def test_interval_bands_drop_non_finite_endpoints(self):
        bands, dropped = gj.compute_interval_bands([
            ("Good", "ci_mean", (1.0, 2.0)),
            ("Bad", "ci_median", (float("nan"), 2.0)),
            ("Missing", "pi", None),
        ])
        assert [b["label"] for b in bands] == ["Good"]
        assert dropped == ["Bad"]

    def test_interval_bands_accept_numpy_arrays_from_the_bootstrap(self):
        bands, dropped = gj.compute_interval_bands([
            ("Boot", "ci_mean", np.array([1.5, 3.5])),
        ])
        assert bands[0]["center"] == pytest.approx(2.5)
        assert dropped == []

    def test_rug_subsamples_a_large_column(self):
        rug = gj.compute_rug_data(np.arange(10_000.0), max_points=500)
        assert rug["n_shown"] == 500
        assert rug["n_total"] == 10_000

    def test_histogram_needs_at_least_one_observation(self):
        with pytest.raises(DegenerateDataError):
            gj.compute_histogram_data(np.array([]))

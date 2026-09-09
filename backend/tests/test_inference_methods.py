import json

import pandas as pd

from api.schemas.inference import InferenceParams
from services.inference import calculate_intervals


def _params(**overrides):
    base = dict(session_id="t", column="x")
    base.update(overrides)
    return InferenceParams(**base)


DATA = pd.Series([float(v) for v in range(2, 42)])  # n = 40


def _method(table, statistic):
    rows = json.loads(table.to_json(orient="records"))
    return next(r["Method"] for r in rows if r["Statistic"] == statistic)


def test_mean_method_t_for_sample_sd():
    ci, _, _, _, _, ctx = calculate_intervals(DATA, _params(sigma_estimator="Deviation (1 ddof)"))
    assert _method(ci, "Mean").startswith("t (df=")
    assert _method(ci, "Deviation") == "Chi-square (s, ddof=1)"
    assert ctx["n"] == 40


def test_mean_method_normal_for_robust_scale():
    ci, _, _, _, _, _ = calculate_intervals(DATA, _params(sigma_estimator="MAD (bias corrected)"))
    assert _method(ci, "Mean") == "Normal (z, MAD)"
    assert _method(ci, "Deviation") == "Normal (asymptotic, MAD)"


def test_mean_method_bootstrap_when_toggled():
    ci, _, _, _, _, _ = calculate_intervals(
        DATA, _params(bootstrap_mean=True, bootstrap_samples=200)
    )
    assert _method(ci, "Mean").startswith("Bootstrap")


def test_pi_iqr_row_names_its_normal_calibration():
    _, pi, _, _, _, _ = calculate_intervals(DATA, _params())
    assert _method(pi, "IQR") == "IQR (normal-scaled)"


def test_regions_ci_box_follows_mu_ci_source():
    """The returned box must be the CI that actually padded the grid."""
    from api.schemas.inference import ConfidenceRegionsParams
    from services.inference import calculate_regions

    def _p(source):
        return ConfidenceRegionsParams(
            session_id="t", column="x", probs=[0.5, 0.95],
            eps_mu=[0.1, 0.1], eps_sigma=[0.05, 0.05], mu_ci_source=source,
        )

    by_mean = calculate_regions(DATA, _p("Mean-based CI"))["mu_ci"]
    by_median = calculate_regions(DATA, _p("Median-based CI"))["mu_ci"]
    assert by_mean != by_median

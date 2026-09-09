import pytest
from scipy.stats import chi2, f, t

from core.hypothesis_testing.rejection_region import (
    compute_rejection_region_data,
    resolve_tail,
)

DOF_T = (24.0,)
ALPHA = 0.05


def _region(**overrides):
    base = dict(
        dist="t",
        dof=DOF_T,
        statistic=2.443704,
        p_value=0.022265,
        alpha=ALPHA,
        tail="two-sided",
    )
    base.update(overrides)
    return compute_rejection_region_data(**base)


# ── critical values match scipy directly ──────────────────────────────────────

def test_two_sided_criticals_are_symmetric_t_quantiles():
    res = _region()
    lo, hi = res["critical_values"]
    assert lo == pytest.approx(t.ppf(ALPHA / 2, *DOF_T))
    assert hi == pytest.approx(t.ppf(1 - ALPHA / 2, *DOF_T))
    assert lo == pytest.approx(-hi)


def test_one_tailed_criticals_use_the_full_alpha():
    assert _region(tail="greater")["critical_values"] == [pytest.approx(t.ppf(1 - ALPHA, *DOF_T))]
    assert _region(tail="less")["critical_values"] == [pytest.approx(t.ppf(ALPHA, *DOF_T))]


# ── shading: reject_region follows alpha, p_area follows the statistic ─────────

def test_two_sided_shades_both_tails_from_different_edges():
    res = _region()
    (rr_lo, rr_hi) = res["reject_region"]
    (pa_lo, pa_hi) = res["p_area"]

    assert rr_lo[1] == pytest.approx(-res["critical_values"][1])
    assert rr_hi[0] == pytest.approx(res["critical_values"][1])
    assert pa_lo[1] == pytest.approx(-res["statistic"])
    assert pa_hi[0] == pytest.approx(res["statistic"])


def test_greater_shades_only_the_upper_tail():
    res = _region(tail="greater")
    assert len(res["reject_region"]) == 1
    assert len(res["p_area"]) == 1
    assert res["reject_region"][0][0] == pytest.approx(res["critical_values"][0])
    assert res["p_area"][0][0] == pytest.approx(res["statistic"])
    assert res["reject_region"][0][1] == res["x"][-1]


def test_less_shades_only_the_lower_tail():
    res = _region(statistic=-2.443704, tail="less")
    assert res["reject_region"][0][0] == res["x"][0]
    assert res["reject_region"][0][1] == pytest.approx(res["critical_values"][0])
    assert res["p_area"][0][1] == pytest.approx(res["statistic"])


def test_regions_are_clipped_to_the_plotted_grid():
    res = _region()
    x_lo, x_hi = res["x"][0], res["x"][-1]
    for lo, hi in res["reject_region"] + res["p_area"]:
        assert x_lo <= lo <= hi <= x_hi


# ── grid always contains the statistic ────────────────────────────────

def test_grid_stretches_to_hold_an_extreme_statistic():
    res = _region(statistic=99.0, p_value=1e-30)
    assert res["x"][0] <= 99.0 <= res["x"][-1]


def test_chi2_and_f_grids_start_at_zero():
    assert compute_rejection_region_data(
        dist="chi2", dof=(1,), statistic=2.758, p_value=0.0968, alpha=ALPHA, tail="greater"
    )["x"][0] == 0.0
    assert compute_rejection_region_data(
        dist="f", dof=(1, 41), statistic=2.967, p_value=0.0925, alpha=ALPHA, tail="greater"
    )["x"][0] == 0.0


def test_curve_is_the_null_pdf():
    res = _region()
    assert len(res["pdf"]) == len(res["x"]) == 400
    assert res["pdf"][200] == pytest.approx(t.pdf(res["x"][200], *DOF_T))


# ── verdict ───────────────────────────────────────────────────────────────────

def test_reject_is_true_only_below_alpha():
    assert _region(p_value=0.049)["reject"] is True
    assert _region(p_value=0.051)["reject"] is False


def test_p_equal_to_alpha_does_not_reject():
    assert _region(p_value=ALPHA)["reject"] is False


# ── chi2 / F ignore the alternative-hypothesis radio ──────────────────────────

def test_variance_and_anova_are_upper_tailed_whatever_the_radio_says():
    for alternative in ("two-sided", "greater", "less"):
        assert resolve_tail("chi2", alternative) == "greater"
        assert resolve_tail("f", alternative) == "greater"
    assert resolve_tail("t", "less") == "less"


def test_coerced_tail_is_reported_back_and_used():
    res = compute_rejection_region_data(
        dist="chi2", dof=(1,), statistic=2.758, p_value=0.0968, alpha=ALPHA, tail="two-sided"
    )
    assert res["tail"] == "greater"
    assert res["critical_values"] == [pytest.approx(chi2.ppf(1 - ALPHA, 1))]
    assert len(res["reject_region"]) == 1


def test_f_critical_uses_both_degrees_of_freedom():
    res = compute_rejection_region_data(
        dist="f", dof=(1, 41), statistic=2.967, p_value=0.0925, alpha=ALPHA, tail="greater"
    )
    assert res["critical_values"] == [pytest.approx(f.ppf(1 - ALPHA, 1, 41))]
    assert res["dof"] == [1.0, 41.0]


# ── rejected input ────────────────────────────────────────────────────────────

def test_unknown_distribution_is_rejected():
    with pytest.raises(ValueError, match="Unknown null distribution"):
        _region(dist="z")


def test_f_requires_two_degrees_of_freedom():
    with pytest.raises(ValueError, match="expects 2 degrees-of-freedom"):
        _region(dist="f", dof=(1,))


def test_non_positive_dof_is_rejected():
    with pytest.raises(ValueError, match="must be positive"):
        _region(dof=(0,))


def test_alpha_outside_the_unit_interval_is_rejected():
    for bad in (0.0, 1.0, -0.1, 1.5):
        with pytest.raises(ValueError, match="alpha must be strictly between"):
            _region(alpha=bad)


def test_unknown_alternative_is_rejected():
    with pytest.raises(ValueError, match="Unknown alternative hypothesis"):
        _region(tail="sideways")


# ── output stays JSON-serialisable ────────────────────────────────────────────

def test_output_is_plain_python_types():
    import json

    json.dumps(_region())


# ── y_max keeps a df=1 spike legible and the payload serialisable ─────────────

def test_well_behaved_curve_is_not_clipped():
    res = _region()
    # y_max is the curve's own peak, not the ceiling — nothing was cropped.
    assert res["y_max"] == pytest.approx(max(res["pdf"]))
    assert res["y_max"] < 1.6 * t.pdf(t.median(*DOF_T), *DOF_T)
    # The grid has an even point count, so it straddles rather than hits the mode.
    assert res["y_max"] == pytest.approx(t.pdf(0, *DOF_T), rel=1e-3)


def test_single_dof_spike_is_clipped_to_a_readable_ceiling():
    # chi2(1) reaches ~64 near zero against a useful scale of ~0.5.
    res = compute_rejection_region_data(
        dist="chi2", dof=(1,), statistic=2.758, p_value=0.0968, alpha=ALPHA, tail="greater"
    )
    assert res["y_max"] == pytest.approx(1.6 * chi2.pdf(chi2.median(1), 1))
    assert max(res["pdf"]) <= res["y_max"] + 1e-12
    assert res["y_max"] < 1.0


def test_levene_shape_is_finite_at_the_origin():
    # Levene with two groups is F(1, N-2) — the default test, and f.pdf(0, 1, n) is inf.
    res = compute_rejection_region_data(
        dist="f", dof=(1, 41), statistic=2.967, p_value=0.0925, alpha=ALPHA, tail="greater"
    )
    assert all(v == v and v not in (float("inf"), float("-inf")) for v in res["pdf"])
    assert max(res["pdf"]) <= res["y_max"] + 1e-12


def test_diverging_densities_stay_json_serialisable():
    import json

    for dist, dof in (("chi2", (1,)), ("f", (1, 41))):
        json.dumps(
            compute_rejection_region_data(
                dist=dist, dof=dof, statistic=2.9, p_value=0.09, alpha=ALPHA, tail="greater"
            )
        )

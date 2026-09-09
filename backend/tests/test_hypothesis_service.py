import numpy as np
import pandas as pd
import pytest
from scipy.stats import bartlett, levene

from api.schemas.hypothesis import HypothesisParams
from services.hypothesis import run_hypothesis_test

_RNG = np.random.default_rng(7)

DATA = pd.DataFrame(
    {
        "score": np.concatenate(
            [_RNG.normal(72, 8, 40), _RNG.normal(78, 12, 35), _RNG.normal(70, 9, 30)]
        ),
        "region": ["North"] * 20 + ["East"] * 20 + ["South"] * 35 + ["West"] * 30,
        "shift": (["Day"] * 13 + ["Night"] * 12) * 4 + ["Day"] * 5,
    }
)

ONE_SAMPLE = "One sample Student's t-test"
TWO_SAMPLE = "Two samples Student's t-test"
VARIANCE = "Equal variance between two groups"
ANOVA = "One-way ANOVA"


def _params(**overrides):
    base = dict(session_id="t", column="score", test_type=ONE_SAMPLE, mu0=72.0)
    base.update(overrides)
    return HypothesisParams(**base)


def _group(column, values, name):
    return {"column": column, "values": values, "name": name}


def _two_sample(**overrides):
    base = dict(
        test_type=TWO_SAMPLE,
        mu0=None,
        group1=_group("region", ["North", "East"], "N+E"),
        group2=_group("region", ["South"], "South"),
    )
    base.update(overrides)
    return _params(**base)


# ── the null distribution is picked correctly per test ────────────────────────

def test_one_sample_uses_t_with_n_minus_one_dof():
    res = run_hypothesis_test(DATA, _params())
    region = res["rejection_region"]
    assert region["dist"] == "t"
    assert region["dof"] == [float(len(DATA) - 1)]


def test_welch_dof_is_fractional_and_read_from_pingouin():
    welch = run_hypothesis_test(DATA, _two_sample(correction=True))["rejection_region"]
    pooled = run_hypothesis_test(DATA, _two_sample(correction=False))["rejection_region"]

    assert welch["dof"] != pooled["dof"]
    assert welch["dof"][0] != int(welch["dof"][0])  # fractional, never n1 + n2 - 2
    assert pooled["dof"] == [float(40 + 35 - 2)]    # N+E is 40 rows, South is 35


def test_bartlett_is_chi_square_with_one_dof():
    res = run_hypothesis_test(
        DATA,
        _params(
            test_type=VARIANCE,
            mu0=None,
            variance_test_type="Bartlett",
            group1=_group("region", ["North"], "A"),
            group2=_group("region", ["South"], "B"),
        ),
    )
    assert res["rejection_region"]["dist"] == "chi2"
    assert res["rejection_region"]["dof"] == [1.0]


def test_levene_is_f_with_group_sizes_as_dof():
    res = run_hypothesis_test(
        DATA,
        _params(
            test_type=VARIANCE,
            mu0=None,
            variance_test_type="Levene",
            group1=_group("region", ["North"], "A"),
            group2=_group("region", ["South"], "B"),
        ),
    )
    assert res["rejection_region"]["dist"] == "f"
    assert res["rejection_region"]["dof"] == [1.0, float(20 + 35 - 2)]


def test_anova_reads_both_dof_from_the_result_table():
    res = run_hypothesis_test(
        DATA,
        _params(
            test_type=ANOVA,
            mu0=None,
            anova_column="region",
            anova_levels=["North", "East", "South", "West"],
        ),
    )
    df1, df2 = res["rejection_region"]["dof"]
    assert df1 == 3.0                       # k - 1
    assert df2 == float(len(DATA) - 4)      # N - k, from the Within row


# ── statistics match the underlying libraries ─────────────────────────────────

def test_variance_statistics_match_scipy_directly():
    north = DATA.loc[DATA["region"] == "North", "score"].to_numpy()
    south = DATA.loc[DATA["region"] == "South", "score"].to_numpy()

    for test_type, expected in (
        ("Bartlett", bartlett(north, south)),
        ("Levene", levene(north, south, center="mean")),
    ):
        res = run_hypothesis_test(
            DATA,
            _params(
                test_type=VARIANCE,
                mu0=None,
                variance_test_type=test_type,
                group1=_group("region", ["North"], "A"),
                group2=_group("region", ["South"], "B"),
            ),
        )
        assert res["statistic"] == pytest.approx(expected.statistic)
        assert res["p_value"] == pytest.approx(expected.pvalue)


# ── the alternative-hypothesis radio does not reach the one-tailed tests ──────

@pytest.mark.parametrize("alternative", ["two-sided", "greater", "less"])
def test_variance_and_anova_stay_upper_tailed(alternative):
    variance = run_hypothesis_test(
        DATA,
        _params(
            test_type=VARIANCE,
            mu0=None,
            alternative=alternative,
            group1=_group("region", ["North"], "A"),
            group2=_group("region", ["South"], "B"),
        ),
    )
    anova = run_hypothesis_test(
        DATA,
        _params(
            test_type=ANOVA,
            mu0=None,
            alternative=alternative,
            anova_column="region",
            anova_levels=["North", "East", "South"],
        ),
    )
    assert variance["rejection_region"]["tail"] == "greater"
    assert anova["rejection_region"]["tail"] == "greater"
    assert len(variance["rejection_region"]["reject_region"]) == 1


def test_t_tests_honour_the_alternative():
    assert run_hypothesis_test(DATA, _params(alternative="less"))["rejection_region"]["tail"] == "less"
    assert run_hypothesis_test(DATA, _two_sample(alternative="greater"))["rejection_region"]["tail"] == "greater"


# ── group materialization ─────────────────────────────────────────────────────

def test_a_group_is_the_union_of_the_selected_values():
    res = run_hypothesis_test(DATA, _two_sample())
    by_name = {g["name"]: g for g in res["group_summary"]}
    assert by_name["N+E"]["n"] == 40      # North + East
    assert by_name["South"]["n"] == 35


def test_groups_may_come_from_different_columns():
    res = run_hypothesis_test(
        DATA,
        _two_sample(
            group1=_group("region", ["North"], "North"),
            group2=_group("shift", ["Night"], "Night"),
        ),
    )
    assert [g["name"] for g in res["group_summary"]] == ["North", "Night"]
    assert res["group_summary"][0]["n"] == 20                    # region == North
    assert res["group_summary"][1]["n"] == len(DATA[DATA["shift"] == "Night"])


def test_overlapping_groups_are_warned_about_but_still_run():
    res = run_hypothesis_test(
        DATA,
        _two_sample(
            group1=_group("region", ["North"], "North"),
            group2=_group("shift", ["Night"], "Night"),
        ),
    )
    assert res["warnings"]
    assert "independent" in res["warnings"][0]


def test_disjoint_groups_produce_no_warning():
    assert run_hypothesis_test(DATA, _two_sample())["warnings"] == []


# ── verdict ───────────────────────────────────────────────────────────────────

def test_verdict_follows_alpha():
    strict = run_hypothesis_test(DATA, _two_sample(alpha=1e-8))
    lenient = run_hypothesis_test(DATA, _two_sample(alpha=0.05))
    assert lenient["verdict"] == "Reject H₀"
    assert lenient["reject"] is True
    assert strict["verdict"] == "Fail to reject H₀"
    assert strict["reject"] is False
    assert strict["statistic"] == pytest.approx(lenient["statistic"])  # only the threshold moved


def test_hypotheses_are_stated_with_the_group_names():
    res = run_hypothesis_test(DATA, _two_sample(alternative="greater"))
    assert res["h0"] == "μ(N+E) = μ(South)"
    assert res["h1"] == "μ(N+E) > μ(South)"


def test_one_sample_hypotheses_name_mu0():
    res = run_hypothesis_test(DATA, _params(mu0=72.0, alternative="two-sided"))
    assert res["h0"] == "μ = 72"
    assert res["h1"] == "μ ≠ 72"


# ── rejected input ────────────────────────────────────────────────────────────

def test_missing_mu0_is_rejected():
    with pytest.raises(ValueError, match="μ₀ must be specified"):
        run_hypothesis_test(DATA, _params(mu0=None))


def test_missing_column_is_rejected():
    with pytest.raises(ValueError, match="Column 'nope' not found"):
        run_hypothesis_test(DATA, _params(column="nope"))


def test_unknown_test_type_is_rejected():
    with pytest.raises(ValueError, match="Unknown hypothesis test: Mann-Whitney"):
        run_hypothesis_test(DATA, _params(test_type="Mann-Whitney"))


def test_group_without_a_column_is_rejected():
    with pytest.raises(ValueError, match="No categorical column selected."):
        run_hypothesis_test(DATA, _params(test_type=TWO_SAMPLE, mu0=None))


def test_group_with_no_selected_values_is_rejected():
    with pytest.raises(ValueError, match="No categories selected for column 'region'."):
        run_hypothesis_test(DATA, _two_sample(group1=_group("region", [], "A")))


def test_unknown_categorical_column_is_rejected():
    with pytest.raises(ValueError, match="Categorical column 'nope' not found"):
        run_hypothesis_test(DATA, _two_sample(group1=_group("nope", ["North"], "A")))


def test_group_matching_no_rows_is_rejected():
    with pytest.raises(ValueError, match="One or more groups are empty after filtering."):
        run_hypothesis_test(DATA, _two_sample(group1=_group("region", ["Nowhere"], "A")))


def test_anova_needs_at_least_two_categories():
    with pytest.raises(ValueError, match="At least two categories must be selected for ANOVA."):
        run_hypothesis_test(
            DATA,
            _params(test_type=ANOVA, mu0=None, anova_column="region", anova_levels=["North"]),
        )


def test_anova_without_a_column_is_rejected():
    with pytest.raises(ValueError, match="A categorical column must be selected for ANOVA."):
        run_hypothesis_test(DATA, _params(test_type=ANOVA, mu0=None))


# ── the raw table is passed through untouched ─────────────────────────────────

def test_table_is_the_unrounded_library_output():
    import json

    rows = json.loads(run_hypothesis_test(DATA, _params())["table"])
    assert len(rows) == 1
    # pingouin's own columns, whichever generation is installed, not renamed by us.
    assert "T" in rows[0] and ("p-val" in rows[0] or "p_val" in rows[0])
    assert rows[0]["T"] == pytest.approx(run_hypothesis_test(DATA, _params())["statistic"])

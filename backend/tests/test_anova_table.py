"""``one_way_anova()`` in the professor's module cannot run on the installed
pingouin (it always builds a figure that reads the pre-0.6 ``p-unc`` column).
``anova_table`` exists to serve ANOVA without that figure."""

import numpy as np
import pandas as pd
import pytest

from core.hypothesis_testing import one_way_anova
from core.hypothesis_testing.tables import anova_table

_RNG = np.random.default_rng(0)
DATA = pd.DataFrame(
    {
        "v": np.concatenate([_RNG.normal(105, 10, 25), _RNG.normal(100, 15, 18)]),
        "g": ["A"] * 25 + ["B"] * 18,
    }
)


def _p_value(table):
    for name in ("p-unc", "p_unc"):
        if name in table.columns:
            return float(table[name].iloc[0])
    raise AssertionError(f"no p-value column in {list(table.columns)}")


def test_bundled_anova_cannot_run_on_the_installed_pingouin():
    # Guard on the reason this module exists. If this ever passes, the workaround
    # can go away — but silently keeping it would be worse than a failing test.
    with pytest.raises(KeyError):
        one_way_anova(DATA, numeric_col="v", cat_col="g")


def test_anova_table_returns_the_detailed_frame():
    table = anova_table(DATA, numeric_col="v", cat_col="g")
    assert list(table["Source"]) == ["g", "Within"]
    assert "F" in table.columns and "DF" in table.columns
    assert 0.0 <= _p_value(table) <= 1.0


def test_within_row_carries_the_denominator_degrees_of_freedom():
    table = anova_table(DATA, numeric_col="v", cat_col="g")
    assert float(table["DF"].iloc[0]) == 1.0        # between: k - 1
    assert float(table["DF"].iloc[1]) == 41.0       # within: N - k
    assert pd.isna(table["F"].iloc[1])              # how the Within row is identified


def test_empty_frame_is_rejected():
    with pytest.raises(ValueError, match="Dataset is empty after filtering."):
        anova_table(DATA.iloc[0:0], numeric_col="v", cat_col="g")

"""
Table-only entry points for tests whose package function is bundled with a plot.

``__init__.py`` is kept byte-identical to ``ThotsakanStatistics/core/hypothesis_tests.py``
so the professor can verify the math, and nothing here modifies it.

``one_way_anova()`` in that file has no ``include_graph`` flag — it always builds
its matplotlib figure, and that figure reads ``df_output["p-unc"]``. pingouin
renamed the column to ``p_unc`` in 0.6, so on the installed stack the function
raises ``KeyError: 'p-unc'`` before it can return anything. The other three tests
take ``include_graph=False`` and are unaffected.

This module therefore reproduces only the ``pg.anova`` call, with no plotting, so
the API can serve one-way ANOVA. The statistics are pingouin's, unchanged — the
professor's file stays the reference for the math and stays untouched.
"""

from __future__ import annotations

import pandas as pd
import pingouin as pg


def anova_table(
    data_group: pd.DataFrame,
    *,
    numeric_col: str,
    cat_col: str,
) -> pd.DataFrame:
    """
    One-way ANOVA result table (``pingouin.anova``), without the bundled figure.

    Same call and same arguments as ``one_way_anova()`` in this package; only the
    plotting is left out.
    """
    if data_group.empty:
        raise ValueError("Dataset is empty after filtering.")

    return pg.anova(
        dv=numeric_col,
        between=cat_col,
        data=data_group,
        detailed=True,
    )

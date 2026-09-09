from pydantic import BaseModel
from typing import Dict, List, Optional

# The four tests the original Gradio app supports, verbatim.
ONE_SAMPLE_T = "One sample Student's t-test"
TWO_SAMPLE_T = "Two samples Student's t-test"
EQUAL_VARIANCE = "Equal variance between two groups"
ONE_WAY_ANOVA = "One-way ANOVA"


class GroupSpec(BaseModel):
    """A group is the union of one or more selected values of one categorical column.

    Group 1 and group 2 may name different columns — that flexibility is inherited
    from the Gradio app and is deliberate.
    """
    column: str
    values: List[str]
    name: str = "Group"


class HypothesisParams(BaseModel):
    session_id: str
    column: str
    test_type: str
    alpha: float = 0.05
    alternative: str = "two-sided"
    mu0: Optional[float] = None
    correction: bool = True              # Welch correction for the two-sample t-test
    variance_test_type: str = "Levene"   # "Bartlett" | "Levene"
    group1: Optional[GroupSpec] = None
    group2: Optional[GroupSpec] = None
    anova_column: Optional[str] = None
    anova_levels: Optional[List[str]] = None
    filters: Optional[Dict[str, List[str]]] = None


class RejectionRegionData(BaseModel):
    """Mirrors ``core.hypothesis_testing.rejection_region`` 1:1."""
    dist: str
    dof: List[float]
    x: List[float]
    pdf: List[float]
    y_max: float
    x_range: List[float]
    statistic: float
    statistic_offscale: bool
    critical_values: List[float]
    reject_region: List[List[float]]
    p_area: List[List[float]]
    tail: str
    reject: bool


class GroupSummary(BaseModel):
    name: str
    n: int
    mean: float
    sd: float
    var: float


class HypothesisResponse(BaseModel):
    test_type: str
    table: str  # JSON string of the raw result DataFrame via to_json(orient="records")
    statistic: float
    p_value: float
    alpha: float
    reject: bool
    verdict: str
    h0: str
    h1: str
    rejection_region: RejectionRegionData
    group_summary: Optional[List[GroupSummary]] = None
    warnings: List[str] = []

from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional

GraphType = Literal["Histogram", "PMF", "ECDF"]


class GraphicalParams(BaseModel):
    column: str
    graph_type: GraphType = Field("Histogram", description="Wire vocabulary: 'Histogram', 'PMF', 'ECDF'")

    # Histogram / PMF display options
    bins: Optional[int] = Field(None, ge=2, le=200, description="Histogram bin count; None means numpy 'auto'")
    add_kde: bool = True
    add_data: bool = False

    # Overlays
    add_normal: bool = False
    normal_mu_source: Literal["Mean-based CI", "Median-based CI"] = "Mean-based CI"
    add_ci: bool = False
    ci_choice: Literal["Mean", "Median", "Both"] = "Both"
    add_pi: bool = False
    pi_choice: Literal["Mean", "Median", "IQR", "Bootstrap"] = "Mean"
    conf_level: float = Field(0.95, gt=0.0, lt=1.0)

    # ECDF options
    add_conf_band: bool = True
    ecdf_conf_level: float = Field(0.95, gt=0.0, lt=1.0)

    # Estimators
    mean_estimator: str = "Sample Mean"
    median_estimator: str = "Sample Median"
    sigma_estimator: str = "Deviation (1 ddof)"
    trim_param: Optional[float] = Field(None, gt=0.0, lt=0.5)
    winsor_limits: Optional[str] = None
    weights_column: Optional[str] = None

    # Bootstrap
    bootstrap_mean: bool = False
    bootstrap_median: bool = False
    bootstrap_pi: bool = False
    bootstrap_samples: int = Field(1000, ge=100, le=5000)

    filters: Optional[Dict[str, List[str]]] = None


class HistogramData(BaseModel):
    bins: List[float]
    counts: List[int]
    densities: List[float]


class PMFData(BaseModel):
    values: List[float]
    probs: List[float]


class ECDFData(BaseModel):
    x: List[float]
    y: List[float]
    epsilon: float
    lower: Optional[List[float]] = None
    upper: Optional[List[float]] = None


class Curve(BaseModel):
    x: List[float]
    y: List[float]


class NormalCurve(Curve):
    mu: float
    sigma: float


class RugData(BaseModel):
    x: List[float]
    n_shown: int
    n_total: int


class IntervalBand(BaseModel):
    label: str
    kind: str  # "ci_mean" | "ci_median" | "pi"
    low: float
    high: float
    center: float


class Summary(BaseModel):
    n: int
    n_unique: int


class PointEstimates(BaseModel):
    mu: Optional[float] = None
    sigma: Optional[float] = None


class GraphicalResponse(BaseModel):
    summary: Summary
    histogram_data: Optional[HistogramData] = None
    pmf_data: Optional[PMFData] = None
    ecdf_data: Optional[ECDFData] = None
    kde_curve: Optional[Curve] = None
    normal_curve: Optional[NormalCurve] = None
    rug_data: Optional[RugData] = None
    interval_bands: Optional[List[IntervalBand]] = None
    point_estimates: Optional[PointEstimates] = None
    dist_used: Optional[str] = None
    alpha: Optional[float] = None
    warnings: List[str] = []

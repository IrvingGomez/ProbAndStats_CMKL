from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple, Literal

class DescriptiveRequest(BaseModel):
    session_id: str
    column: str
    quantileProbs: List[float] = [0.25, 0.5, 0.75]
    trimAlpha: Optional[float] = None
    winsorLimits: Optional[Tuple[float, float]] = None
    weightsCol: Optional[str] = None
    filters: Optional[Dict[str, List[str]]] = None

class StatRow(BaseModel):
    category: Literal['Quantiles', 'Central Tendency', 'Dispersion', 'Shape', 'Extremes']
    measure: str
    value: float | None
    consistencyCorr: float | None
    robust: bool = False
    advancedId: Optional[str] = None
    warning: Optional[str] = None

class DescriptiveSummary(BaseModel):
    n: int
    mean: float
    median: float
    std: float
    iqr: float

class HistogramData(BaseModel):
    binEdges: List[float]
    counts: List[int]

class BoxData(BaseModel):
    whiskerLo: float
    q1: float
    median: float
    q3: float
    whiskerHi: float
    outliers: List[float]

class DescriptiveResponse(BaseModel):
    rows: List[StatRow]
    summary: DescriptiveSummary
    histogram: HistogramData
    boxData: BoxData

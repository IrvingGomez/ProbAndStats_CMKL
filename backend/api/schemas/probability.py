from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Union


class DistributionRequest(BaseModel):
    distName: str
    params: dict[str, float]
    queryOp: str
    queryK: float


class DistributionResponse(BaseModel):
    # discrete fields
    ks: Optional[list[int]] = None
    probs: Optional[list[float]] = None
    cumProbs: Optional[list[float]] = None
    # continuous fields
    xs: Optional[list[float]] = None
    ys: Optional[list[float]] = None
    cdfYs: Optional[list[float]] = None
    # shared
    queryResult: float
    theorMean: Union[float, str]
    theorVariance: Union[float, str]


class NormalPDFRequest(BaseModel):
    mean: float
    std: float
    n: int
    alpha: float


class NormalPDFResponse(BaseModel):
    xValues: list[float]
    yValues: list[float]
    cdfValues: list[float]
    ciLow: float
    ciHigh: float
    shadeX: list[float]
    shadeY: list[float]
    se: float
    zCritical: float

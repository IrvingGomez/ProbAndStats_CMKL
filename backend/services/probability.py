from core.probability.common_distributions.distributions import compute_distribution
from core.probability.common_distributions.normal_pdf import compute_normal_pdf_data
from api.schemas.probability import (
    DistributionRequest,
    DistributionResponse,
    NormalPDFRequest,
    NormalPDFResponse,
)


def compute_distribution_response(req: DistributionRequest) -> DistributionResponse:
    data = compute_distribution(req.distName, req.params, req.queryOp, req.queryK)
    return DistributionResponse(**data)


def compute_normal_pdf_response(req: NormalPDFRequest) -> NormalPDFResponse:
    data = compute_normal_pdf_data(req.mean, req.std, req.n, req.alpha)
    return NormalPDFResponse(**data)

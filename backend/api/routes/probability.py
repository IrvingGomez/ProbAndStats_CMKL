from fastapi import APIRouter, HTTPException

from api.schemas.probability import (
    DistributionRequest,
    DistributionResponse,
    NormalPDFRequest,
    NormalPDFResponse,
)
from services.probability import compute_distribution_response, compute_normal_pdf_response

router = APIRouter()


@router.post("/compute", response_model=DistributionResponse)
def compute_distribution(request: DistributionRequest):
    try:
        return compute_distribution_response(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/normal-pdf", response_model=NormalPDFResponse)
def compute_normal_pdf(request: NormalPDFRequest):
    try:
        return compute_normal_pdf_response(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

from fastapi import APIRouter, Depends, HTTPException
import pandas as pd
from api.deps import apply_filters, get_session_data
from api.schemas.hypothesis import HypothesisParams, HypothesisResponse
from services.hypothesis import run_hypothesis_test

router = APIRouter(prefix="/api/hypothesis", tags=["hypothesis"])


@router.post("/test", response_model=HypothesisResponse)
def run_test(params: HypothesisParams, df: pd.DataFrame = Depends(get_session_data)):
    if params.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column {params.column} not found")

    # Filter first, then materialize groups, so the Data tab's active filters
    # narrow the groups rather than being applied after they are built.
    df = apply_filters(df, params.filters)

    try:
        res = run_hypothesis_test(df, params)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return HypothesisResponse(**res)

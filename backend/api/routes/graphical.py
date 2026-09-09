from fastapi import APIRouter, Depends, HTTPException
import pandas as pd
from api.deps import apply_filters, get_session_data
from api.schemas.graphical import GraphicalParams, GraphicalResponse
from services.graphical import compute_graphical_data

router = APIRouter(prefix="/api/graphical", tags=["graphical"])


@router.post("/compute", response_model=GraphicalResponse)
def compute_graph(params: GraphicalParams, df: pd.DataFrame = Depends(get_session_data)):
    if params.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column {params.column} not found")
    df = apply_filters(df, params.filters)

    try:
        res = compute_graphical_data(df, params)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return GraphicalResponse(**res)

import pandas as pd
from typing import Any, Dict

from core.estimation.graphical_analysis import compute_graphical_data as _core_graphical
from api.schemas.graphical import GraphicalParams


def compute_graphical_data(data: pd.Series, params: GraphicalParams) -> Dict[str, Any]:
    return _core_graphical(
        data.to_numpy(),
        graph_type=params.graph_type,
        add_kde=params.add_kde,
        add_normal=params.add_normal,
    )

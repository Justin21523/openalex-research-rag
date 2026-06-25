"""GET /graph — concept co-occurrence graph."""

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_conn
from src.api.schemas.responses import ConceptEdge, ConceptGraph, ConceptNode
from src.features.concept_graph import build_concept_cooccurrence

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/concept-cooccurrence", response_model=ConceptGraph)
def concept_cooccurrence(
    top_n: int = Query(20, ge=5, le=100),
    min_weight: int = Query(2, ge=1),
    conn=Depends(get_conn),
) -> ConceptGraph:
    data = build_concept_cooccurrence(conn, min_weight=min_weight, top_n=top_n)
    return ConceptGraph(
        nodes=[ConceptNode(**n) for n in data["nodes"]],
        edges=[ConceptEdge(**e) for e in data["edges"]],
    )

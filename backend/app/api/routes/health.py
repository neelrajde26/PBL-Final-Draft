from fastapi import APIRouter, Query

from app.services.gee.gee_client import gee_client


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "Maharashtra Drought Intelligence System API",
        "gee": gee_client.health(verify_remote=False).to_dict(),
    }


@router.get("/satellite/status")
def satellite_status(
    verify_remote: bool = Query(
        False,
        description="Evaluate a minimal Earth Engine expression; may add latency.",
    ),
) -> dict[str, object]:
    return gee_client.health(verify_remote=verify_remote).to_dict()


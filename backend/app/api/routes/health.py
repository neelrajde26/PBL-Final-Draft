from fastapi import APIRouter, Query

from app.db import database
from app.services.gee.gee_client import gee_client


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "Maharashtra Drought Intelligence System API",
        "gee": gee_client.health(verify_remote=False).to_dict(),
    }


@router.get("/ready")
def readiness() -> dict[str, object]:
    database_health = database.health()
    gee_health = gee_client.health(verify_remote=False)
    ready = database_health.available
    return {
        "status": "ready" if ready else "not_ready",
        "database": database_health.to_dict(),
        "gee": gee_health.to_dict(),
    }


@router.get("/satellite/status")
def satellite_status(
    verify_remote: bool = Query(
        False,
        description="Evaluate a minimal Earth Engine expression; may add latency.",
    ),
) -> dict[str, object]:
    return gee_client.health(verify_remote=verify_remote).to_dict()


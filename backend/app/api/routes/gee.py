from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import database
from app.services.gee.gee_client import gee_client
from app.services.gee.gee_collections import COLLECTIONS


router = APIRouter(prefix="/gee", tags=["gee"])


@router.get("/health")
def gee_health(
    verify_remote: bool = Query(True, description="Execute a minimal remote evaluation."),
) -> dict[str, object]:
    return gee_client.health(verify_remote=verify_remote).to_dict()


@router.get("/status")
def gee_status() -> dict[str, object]:
    return gee_client.health(verify_remote=False).to_dict()


@router.get("/collections")
def gee_collections() -> dict[str, object]:
    items = [spec.public_metadata() for spec in COLLECTIONS.values()]
    return {"count": len(items), "items": items}


@router.get("/ingestion/history")
def ingestion_history(limit: int = Query(50, ge=1, le=500)) -> dict[str, object]:
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT id, collection_key, status, period_start, period_end,
                           started_at, finished_at, district_count,
                           observation_count, retry_count,
                           last_successful_acquisition, error_type, error_message,
                           metadata
                    FROM ingestion_logs
                    ORDER BY started_at DESC
                    LIMIT :limit
                    """
                ),
                {"limit": limit},
            ).mappings()
            items = [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Ingestion database is unavailable") from exc
    return {"count": len(items), "items": items}

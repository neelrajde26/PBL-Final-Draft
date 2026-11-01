from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import database
from app.services.gee.gee_collections import COLLECTIONS, get_collection_spec


router = APIRouter(prefix="/satellite", tags=["satellite"])


@router.get("/collections")
def list_collections() -> dict[str, object]:
    items = [spec.public_metadata() for spec in COLLECTIONS.values()]
    return {"count": len(items), "items": items}


@router.get("/collections/{collection_key}")
def collection_detail(collection_key: str) -> dict[str, object]:
    try:
        return get_collection_spec(collection_key).public_metadata()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/indicators")
def list_indicators() -> dict[str, object]:
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT o.variable_key, s.key AS source_key, s.name AS source_name,
                           s.product_id, s.native_temporal_resolution,
                           s.native_spatial_resolution_m,
                           max(o.observation_time) AS last_acquisition,
                           max(o.ingested_at) AS last_ingestion,
                           bool_or(o.is_demo) AS contains_demo
                    FROM environmental_observations o
                    JOIN data_sources s ON s.id = o.data_source_id
                    GROUP BY o.variable_key, s.key, s.name, s.product_id,
                             s.native_temporal_resolution, s.native_spatial_resolution_m
                    ORDER BY o.variable_key, s.key
                    """
                )
            ).mappings()
            items = [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Observation database is unavailable") from exc
    return {"count": len(items), "items": items}


@router.get("/district/{district_id}")
def district_indicators(
    district_id: str,
    variable: str | None = None,
    start: datetime = Query(default=datetime(2000, 1, 1, tzinfo=UTC)),
    end: datetime | None = None,
    limit: int = Query(1000, ge=1, le=5000),
) -> dict[str, object]:
    effective_end = end or datetime.now(UTC)
    if effective_end <= start:
        raise HTTPException(status_code=422, detail="end must be after start")
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT o.variable_key, o.observation_time, o.period_start,
                           o.period_end, o.mean_value, o.median_value,
                           o.minimum_value, o.maximum_value,
                           o.valid_pixel_count, o.total_pixel_count,
                           o.coverage_percentage, o.unit, o.quality_status,
                           o.processing_metadata, o.ingested_at, o.is_demo,
                           s.key AS source_key, s.name AS source_name,
                           s.product_id, s.native_temporal_resolution,
                           s.native_spatial_resolution_m, b.boundary_version
                    FROM environmental_observations o
                    JOIN data_sources s ON s.id = o.data_source_id
                    JOIN district_boundaries b ON b.id = o.boundary_id
                    WHERE o.district_id = :district_id
                      AND (CAST(:variable AS text) IS NULL OR o.variable_key = :variable)
                      AND o.observation_time >= :start
                      AND o.observation_time < :end
                    ORDER BY o.observation_time, o.variable_key
                    LIMIT :limit
                    """
                ),
                {
                    "district_id": district_id,
                    "variable": variable,
                    "start": start,
                    "end": effective_end,
                    "limit": limit,
                },
            ).mappings()
            items = [dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Observation database is unavailable") from exc
    return {"district_id": district_id, "count": len(items), "items": items}


"""Drought index analytics, district time series, and historical event endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.data.districts import get_district
from app.db import database
from app.services.indices.agricultural import calculate_vci, calculate_vhi
from app.services.indices.events import detect_drought_events
from app.services.indices.meteorological import calculate_spi, classify_drought_severity

router = APIRouter(prefix="/drought", tags=["drought"])


@router.get("/indices")
def list_drought_indices(
    domain: str | None = Query(None, description="meteorological, agricultural, or hydrological"),
    district_id: str | None = Query(None, description="Filter by district ID"),
) -> dict[str, object]:
    """Retrieve computed drought indices."""
    items: list[dict[str, Any]] = []
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT id, district_id, index_key, drought_domain, observation_date,
                           accumulation_months, value, category, method_version, quality_status
                    FROM drought_indices
                    WHERE (:domain IS NULL OR drought_domain = :domain)
                      AND (:district_id IS NULL OR district_id = :district_id)
                    ORDER BY observation_date DESC
                    LIMIT 200
                    """
                ),
                {"domain": domain, "district_id": district_id},
            ).mappings()
            items = [dict(r) for r in rows]
    except Exception:
        pass

    return {
        "count": len(items),
        "items": items,
        "status": "data_available" if items else "no_stored_records",
    }


@router.get("/district/{district_id}")
def district_drought_series(
    district_id: str,
    limit: int = Query(100, ge=1, le=1000),
) -> dict[str, object]:
    """Retrieve multi-index drought profile for a specific district."""
    district = get_district(district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found.")

    records: list[dict[str, Any]] = []
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT index_key, drought_domain, observation_date, accumulation_months,
                           value, category, method_version
                    FROM drought_indices
                    WHERE district_id = :district_id
                    ORDER BY observation_date DESC
                    LIMIT :limit
                    """
                ),
                {"district_id": district.id, "limit": limit},
            ).mappings()
            records = [dict(r) for r in rows]
    except Exception:
        pass

    return {
        "district_id": district.id,
        "district_name": district.name,
        "region": district.region,
        "count": len(records),
        "series": records,
    }


@router.get("/events")
def list_drought_events(
    district_id: str | None = Query(None, description="Filter by district ID"),
    severity: str | None = Query(None, description="Moderate, Severe, or Extreme"),
) -> dict[str, object]:
    """Retrieve identified historical drought events and their onset/recovery dates."""
    events: list[dict[str, Any]] = []
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT id, district_id, drought_domain, onset_date, recovery_date,
                           peak_date, duration_days, intensity, severity, method_version
                    FROM drought_events
                    WHERE (:district_id IS NULL OR district_id = :district_id)
                      AND (:severity IS NULL OR severity = :severity)
                    ORDER BY onset_date DESC
                    """
                ),
                {"district_id": district_id, "severity": severity},
            ).mappings()
            events = [dict(r) for r in rows]
    except Exception:
        pass

    return {
        "count": len(events),
        "items": events,
    }


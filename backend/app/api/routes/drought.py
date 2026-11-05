"""Drought index analytics, district time series, and historical event endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services import store
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

    if not items:
        df = store.frame("indices")
        if not df.empty:
            if district_id:
                df = df[df["district_id"] == district_id]
            df = df.sort_values("date", ascending=False).head(200)
            for r in df.itertuples():
                dt = r.date.date().isoformat()
                if domain in (None, "meteorological") and hasattr(r, "spi_3") and r.spi_3 == r.spi_3:
                    items.append({
                        "id": f"idx-spi3-{r.district_id}-{dt}", "district_id": r.district_id, "index_key": "spi_3",
                        "drought_domain": "meteorological", "observation_date": dt, "accumulation_months": 3,
                        "value": round(float(r.spi_3), 3), "category": classify_drought_severity(float(r.spi_3)),
                        "method_version": "pipeline-2.0", "quality_status": "gee_extract",
                    })
                if domain in (None, "agricultural") and hasattr(r, "vhi") and r.vhi == r.vhi:
                    items.append({
                        "id": f"idx-vhi-{r.district_id}-{dt}", "district_id": r.district_id, "index_key": "vhi",
                        "drought_domain": "agricultural", "observation_date": dt, "accumulation_months": 1,
                        "value": round(float(r.vhi), 2),
                        "category": "Severe Agricultural Drought" if r.vhi <= 20 else ("Moderate Agricultural Drought" if r.vhi < 35 else "Normal"),
                        "method_version": "pipeline-2.0", "quality_status": "gee_extract",
                    })

    return {
        "count": len(items),
        "items": items,
        "status": "data_available" if items else "awaiting_ingestion",
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

    if not records:
        df = store.frame("indices")
        if not df.empty and "spi_3" in df:
            sel = df[df["district_id"] == district.id].dropna(subset=["spi_3"]).sort_values("date", ascending=False).head(limit)
            for r in sel.itertuples():
                records.append({
                    "index_key": "spi_3", "drought_domain": "meteorological",
                    "observation_date": r.date.date().isoformat(), "accumulation_months": 3,
                    "value": round(float(r.spi_3), 3), "category": classify_drought_severity(float(r.spi_3)),
                    "method_version": "pipeline-2.0",
                })

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


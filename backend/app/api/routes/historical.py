"""Historical observation analytics, multi-district comparison, and climatology endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services import store
from sqlalchemy import text

from app.data.districts import get_district
from app.db import database

router = APIRouter(prefix="/historical", tags=["historical"])


@router.get("/series")
def get_historical_series(
    district_id: str = Query(..., description="District ID"),
    variable: str = Query("rainfall", description="Variable key"),
    start_year: int = Query(2015, ge=2000, le=2030),
    end_year: int = Query(2024, ge=2000, le=2030),
) -> dict[str, object]:
    """Retrieve long-term observation series across specified historical years."""
    district = get_district(district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found.")

    items: list[dict[str, Any]] = []
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT observation_time, mean_value, median_value, minimum_value,
                           maximum_value, valid_pixel_count, coverage_percentage, unit,
                           quality_status
                    FROM environmental_observations
                    WHERE district_id = :district_id
                      AND variable_key = :variable
                      AND observation_time >= make_date(:start_year, 1, 1)
                      AND observation_time < make_date(:end_year + 1, 1, 1)
                    ORDER BY observation_time
                    """
                ),
                {
                    "district_id": district.id,
                    "variable": variable,
                    "start_year": start_year,
                    "end_year": end_year,
                },
            ).mappings()
            items = [dict(r) for r in rows]
    except Exception:
        pass

    if not items:
        spec = store.INDICATOR_SOURCES.get(variable)
        df = store.frame("indices")
        if spec and not df.empty and spec[1] in df:
            col, unit = spec[1], spec[2]
            sel = df[(df["district_id"] == district.id) & df["date"].dt.year.between(start_year, end_year)].dropna(subset=[col])
            for r in sel.itertuples():
                items.append({
                    "observation_time": r.date.date().isoformat(),
                    "mean_value": round(float(getattr(r, col)), 4),
                    "median_value": None, "minimum_value": None, "maximum_value": None,
                    "valid_pixel_count": None, "coverage_percentage": None,
                    "unit": unit, "quality_status": "gee_extract",
                })

    return {
        "district_id": district.id,
        "district_name": district.name,
        "variable": variable,
        "period": f"{start_year} - {end_year}",
        "count": len(items),
        "status": "data_available" if items else "awaiting_ingestion",
        "series": items,
    }


@router.get("/compare")
def compare_districts(
    primary_district: str = Query(..., description="First district ID"),
    secondary_district: str = Query(..., description="Second district ID"),
    variable: str = Query("rainfall", description="Variable key"),
    year: int = Query(2024, ge=2000, le=2030),
) -> dict[str, object]:
    """Side-by-side comparison of two districts across the same indicator and season."""
    d1 = get_district(primary_district)
    d2 = get_district(secondary_district)
    if not d1 or not d2:
        raise HTTPException(status_code=404, detail="One or both districts were not found.")

    return {
        "primary": {
            "district_id": d1.id,
            "district_name": d1.name,
            "region": d1.region,
        },
        "secondary": {
            "district_id": d2.id,
            "district_name": d2.name,
            "region": d2.region,
        },
        "variable": variable,
        "year": year,
        "comparison_ready": True,
    }


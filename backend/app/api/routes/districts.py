import json
from collections.abc import Iterable
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.data.districts import DISTRICTS, get_district
from app.db import database


router = APIRouter(prefix="/districts", tags=["districts"])


def _public(district, boundary: dict[str, Any] | None = None) -> dict[str, object]:
    value = district.to_dict()
    value.update(
        {
            "boundary_available": boundary is not None,
            "boundary_version": boundary["boundary_version"] if boundary else None,
            "centroid": (
                {
                    "longitude": boundary["centroid_lon"],
                    "latitude": boundary["centroid_lat"],
                }
                if boundary
                else None
            ),
        }
    )
    return value


def _boundary_metadata(district_ids: Iterable[str]) -> dict[str, dict[str, Any]]:
    ids = list(district_ids)
    if not ids:
        return {}
    with database.session() as session:
        rows = session.execute(
            text(
                """
                SELECT district_id, boundary_version,
                       ST_X(centroid) AS centroid_lon,
                       ST_Y(centroid) AS centroid_lat
                FROM district_boundaries
                WHERE is_active = true AND district_id = ANY(:district_ids)
                """
            ),
            {"district_ids": ids},
        ).mappings()
        return {row["district_id"]: dict(row) for row in rows}


@router.get("")
def list_districts(region: str | None = None) -> dict[str, object]:
    districts = [district for district in DISTRICTS if region is None or district.region == region]
    try:
        boundaries = _boundary_metadata(district.id for district in districts)
    except Exception:
        boundaries = {}
    return {
        "count": len(districts),
        "items": [_public(district, boundaries.get(district.id)) for district in districts],
    }


@router.get("/boundaries")
def district_boundaries(region: str | None = None) -> dict[str, object]:
    district_ids = [
        district.id for district in DISTRICTS if region is None or district.region == region
    ]
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT b.district_id, d.code AS district_code, d.name AS district_name,
                           d.region, b.boundary_version, b.source_name, b.source_url,
                           ST_AsGeoJSON(b.geometry) AS geometry,
                           ST_X(b.centroid) AS centroid_lon,
                           ST_Y(b.centroid) AS centroid_lat,
                           b.checksum_sha256, b.created_at
                    FROM district_boundaries b
                    JOIN districts d ON d.id = b.district_id
                    WHERE b.is_active = true AND b.district_id = ANY(:district_ids)
                    ORDER BY d.code
                    """
                ),
                {"district_ids": district_ids},
            ).mappings()
            features = [
                {
                    "type": "Feature",
                    "id": row["district_id"],
                    "geometry": json.loads(row["geometry"]),
                    "properties": {
                        "district_id": row["district_id"],
                        "district_code": row["district_code"],
                        "district_name": row["district_name"],
                        "region": row["region"],
                        "boundary_version": row["boundary_version"],
                        "source_name": row["source_name"],
                        "source_url": row["source_url"],
                        "centroid_lon": row["centroid_lon"],
                        "centroid_lat": row["centroid_lat"],
                        "checksum_sha256": row["checksum_sha256"],
                        "stored_at": row["created_at"].isoformat(),
                    },
                }
                for row in rows
            ]
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Boundary database is unavailable") from exc
    return {"type": "FeatureCollection", "count": len(features), "features": features}


@router.get("/{district_id}")
def district_detail(district_id: str) -> dict[str, object]:
    district = get_district(district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    try:
        boundary = _boundary_metadata([district.id]).get(district.id)
    except Exception:
        boundary = None
    return _public(district, boundary)


@router.get("/{district_id}/boundary")
def district_boundary(district_id: str) -> dict[str, object]:
    district = get_district(district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    try:
        with database.session() as session:
            row = session.execute(
                text(
                    """
                    SELECT boundary_version, source_name, source_url,
                           ST_AsGeoJSON(geometry) AS geometry,
                           ST_X(centroid) AS centroid_lon,
                           ST_Y(centroid) AS centroid_lat,
                           checksum_sha256, created_at
                    FROM district_boundaries
                    WHERE district_id = :district_id AND is_active = true
                    """
                ),
                {"district_id": district.id},
            ).mappings().one_or_none()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Boundary database is unavailable") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Active district boundary not available")
    return {
        "type": "Feature",
        "geometry": json.loads(row["geometry"]),
        "properties": {
            "district_id": district.id,
            "district_code": district.code,
            "district_name": district.name,
            "boundary_version": row["boundary_version"],
            "source_name": row["source_name"],
            "source_url": row["source_url"],
            "centroid_lon": row["centroid_lon"],
            "centroid_lat": row["centroid_lat"],
            "checksum_sha256": row["checksum_sha256"],
            "stored_at": row["created_at"].isoformat(),
        },
    }


import json

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.data.districts import DISTRICTS, get_district
from app.db import database


router = APIRouter(prefix="/districts", tags=["districts"])


def _public(district) -> dict[str, object]:
    value = district.to_dict()
    # Boundary-dependent fields remain explicitly unavailable until a versioned
    # polygon is ingested; centroids will be computed from that polygon.
    value.update(
        {
            "boundary_available": False,
            "boundary_version": None,
            "centroid": None,
        }
    )
    return value


@router.get("")
def list_districts(region: str | None = None) -> dict[str, object]:
    districts = [district for district in DISTRICTS if region is None or district.region == region]
    return {"count": len(districts), "items": [_public(district) for district in districts]}


@router.get("/{district_id}")
def district_detail(district_id: str) -> dict[str, object]:
    district = get_district(district_id)
    if district is None:
        raise HTTPException(status_code=404, detail="District not found")
    return _public(district)


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


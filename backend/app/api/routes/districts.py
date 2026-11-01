from fastapi import APIRouter, HTTPException

from app.data.districts import DISTRICTS, get_district


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


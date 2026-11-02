import geopandas as gpd
import pytest
from shapely.geometry import box

from app.data.districts import DISTRICTS
from app.services.boundaries.importer import BoundaryValidationError, prepare_boundaries


def _synthetic_frame() -> gpd.GeoDataFrame:
    names = [district.name for district in DISTRICTS]
    names[names.index("Ahilyanagar")] = "Ahmednagar"
    names[names.index("Chhatrapati Sambhajinagar")] = "Aurangabad"
    names[names.index("Dharashiv")] = "Osmanabad"
    geometries = []
    for index in range(36):
        column = index % 6
        row = index // 6
        x = 72.0 + column * 1.5
        y = 15.5 + row * 1.25
        geometries.append(box(x, y, x + 1.0, y + 0.9))
    return gpd.GeoDataFrame(
        {"STATE": ["Maharashtra"] * 36, "DISTRICT": names},
        geometry=geometries,
        crs="EPSG:4326",
    )


def test_prepare_boundaries_reconciles_all_36_districts() -> None:
    result = prepare_boundaries(
        _synthetic_frame(),
        state_column="STATE",
        district_column="DISTRICT",
    )
    assert len(result) == 36
    assert set(result["district_id"]) == {district.id for district in DISTRICTS}
    assert result.geometry.geom_type.eq("MultiPolygon").all()
    assert result["centroid_lon"].notna().all()


def test_prepare_boundaries_rejects_missing_district() -> None:
    frame = _synthetic_frame().iloc[:-1].copy()
    with pytest.raises(BoundaryValidationError, match="Expected 36 districts"):
        prepare_boundaries(frame, state_column="STATE", district_column="DISTRICT")

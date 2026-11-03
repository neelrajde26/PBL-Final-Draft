from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.services.gee.district_extractor import InvalidDistrictBoundary, validate_polygon_geometry
from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_collections import COLLECTIONS, TemporalResolution
from app.services.gee.raster_service import (
    GeeTileCoordinateError,
    GeeTileUnavailableError,
    validate_tile_coordinates,
    raster_service,
)


def test_required_collection_ids_are_registered() -> None:
    ids = {spec.collection_id for spec in COLLECTIONS.values()}
    assert "UCSB-CHG/CHIRPS/DAILY" in ids
    assert "MODIS/061/MOD13Q1" in ids
    assert "MODIS/061/MOD11A2" in ids
    assert "MODIS/061/MOD16A2" in ids
    assert "MODIS/061/MOD16A2GF" in ids
    assert "NASA/GLDAS/V021/NOAH/G025/T3H" in ids
    assert "ECMWF/ERA5_LAND/DAILY_AGGR" in ids
    assert "NASA/SMAP/SPL3SMP_E/006" in ids
    assert "COPERNICUS/S2_SR_HARMONIZED" in ids
    assert "COPERNICUS/S1_GRD" in ids
    assert "NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI" in ids


def test_native_cadence_is_not_coerced_to_daily() -> None:
    assert COLLECTIONS["modis_vi"].temporal_resolution == TemporalResolution.SIXTEEN_DAY
    assert COLLECTIONS["modis_et"].temporal_resolution == TemporalResolution.EIGHT_DAY
    assert COLLECTIONS["grace_mascon_cri"].temporal_resolution == TemporalResolution.MONTHLY
    assert COLLECTIONS["modis_vi"].nominal_period_value == 16
    assert COLLECTIONS["modis_lst"].nominal_period_value == 8
    assert COLLECTIONS["gldas_noah"].nominal_period_unit == "hour"


def test_point_or_buffer_substitute_is_rejected() -> None:
    with pytest.raises(InvalidDistrictBoundary):
        validate_polygon_geometry({"type": "Point", "coordinates": [75.75, 18.98]})


def test_unconfigured_health_is_explicit_and_non_fatal() -> None:
    client = EarthEngineClient(
        Settings(gee_project_id=None, gee_use_adc=False, gee_private_key_path=None)
    )
    health = client.health(verify_remote=False)
    assert health.status == "not_configured"
    assert health.available is False


def test_bounded_caching_and_status_semantics() -> None:
    """Ensure consecutive health queries hit cache and report checked_at."""
    client = EarthEngineClient(
        Settings(gee_project_id=None, gee_use_adc=False, gee_private_key_path=None)
    )
    h1 = client.health(verify_remote=False)
    h2 = client.health(verify_remote=False)
    assert h1.checked_at == h2.checked_at
    assert h1.is_stale is False


def test_distinction_between_authenticated_and_connected() -> None:
    """Mock local auth success with remote evaluation failure -> error, not connected."""
    client = EarthEngineClient(
        Settings(gee_project_id="test-proj", gee_use_adc=True, gee_private_key_path=None)
    )
    # Mock ee module
    mock_ee = MagicMock()
    mock_ee.Initialize.return_value = None
    mock_ee.Number.side_effect = RuntimeError("Remote network timeout")

    with patch.dict("sys.modules", {"ee": mock_ee}):
        health = client.health(verify_remote=True, force_refresh=True)
        # Must NOT show connected if remote check fails
        assert health.status in ("error", "authenticated")
        assert health.status != "connected"
        assert health.available is False


def test_raster_tile_coordinate_validation() -> None:
    # Valid zoom 6
    validate_tile_coordinates(6, 45, 28)

    # Negative coordinates
    with pytest.raises(GeeTileCoordinateError):
        validate_tile_coordinates(6, -1, 28)

    # Out of bounds x >= 2^6 (64)
    with pytest.raises(GeeTileCoordinateError):
        validate_tile_coordinates(6, 64, 28)

    # Out of bounds zoom > 18
    with pytest.raises(GeeTileCoordinateError):
        validate_tile_coordinates(19, 100, 100)


def test_raster_tile_endpoint_returns_503_when_gee_unconfigured() -> None:
    client = TestClient(app)
    response = client.get("/api/maps/raster-tile/rainfall/6/45/28")
    # Must report 503 unavailable when GEE is offline
    assert response.status_code == 503
    assert response.headers.get("X-Tile-Status") == "unavailable"


def test_raster_tile_endpoint_returns_404_on_invalid_layer() -> None:
    client = TestClient(app)
    response = client.get("/api/maps/raster-tile/invalid_sensor_layer/6/45/28")
    assert response.status_code == 404


def test_raster_tile_endpoint_returns_400_on_invalid_coords() -> None:
    client = TestClient(app)
    response = client.get("/api/maps/raster-tile/rainfall/6/-5/28")
    assert response.status_code == 400

import pytest

from app.core.config import Settings
from app.services.gee.district_extractor import InvalidDistrictBoundary, validate_polygon_geometry
from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_collections import COLLECTIONS, TemporalResolution


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
    health = client.health()
    assert health.status == "not_configured"
    assert health.available is False


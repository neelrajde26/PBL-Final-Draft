# MDIS Google Earth Engine (GEE) Integration Test Report

## Maharashtra Drought Intelligence System (MDIS)
**Date:** November 2026  
**Tested Component:** `backend/app/services/gee/gee_client.py`, `raster_service.py`, `ingestion.py`, `/api/gee/*`, `/api/maps/raster-tile/*`  
**Test Suite:** `backend/tests/test_gee_contracts.py` (10 tests)  
**Status:** **VERIFIED CONTRACT COMPLIANCE & ACCURATE HEALTH SEMANTICS**

---

### 1. Architectural Scope & Status Semantics

The Earth Engine integration adheres to the strict 5-state health lifecycle:
- `not_configured`: Required project ID or authentication method is missing.
- `configured`: Settings are populated, but remote connection has not been verified.
- `authenticated`: Local credentials (ADC or service account JSON) initialized successfully.
- `connected`: Active remote Earth Engine server evaluation succeeded.
- `error`: Remote check failed; returns safe error category (`credentials_missing`, `permission_denied`, `missing_project`, `invalid_service_account_key`) with actionable remediation.

Health evaluations are protected by a bounded 60-second in-memory cache with `checked_at` ISO timestamps and `is_stale` flags to avoid hammering remote GEE endpoints on high-frequency UI requests.

---

### 2. Raster Tile Endpoint Implementation

The tile proxy route `/api/maps/raster-tile/{layer}/{z}/{x}/{y}` replaces the previous 204 stub:
1. **Coordinate Validation:** Validates that $z \in [0, 18]$ and $x, y \in [0, 2^z - 1]$. Invalid coordinates return HTTP 400.
2. **Layer Validation:** Checks layer against registered specs (`rainfall`, `ndvi`, `evi`, `lst`, `soil_moisture`). Unsupported layers return HTTP 404.
3. **Availability & Diagnostics:** If GEE credentials are not configured or remote evaluation is offline, the endpoint returns HTTP 503 with header `X-Tile-Status: unavailable`.
4. **Caching:** Server-side LRU in-memory cache stores tile bytes with 1-hour TTL.

---

### 3. Worker Extraction & Persistence Verification

Celery ingestion task `ingest_district_observation` enforces:
1. District registry validation (raises `ValueError` for unknown districts).
2. Date sequence validation (`start_date <= end_date`).
3. Safe distributed lock `TaskLock` with explicit in-memory mutex fallback. Lock contention returns `{"status": "skipped", "reason": "lock_active"}` and never proceeds with duplicate work.
4. Native satellite extraction via `NativeIngestionService` preserving product cadence (CHIRPS daily, MODIS 16-day, SMAP 3-day).
5. Durable logging to `ingestion_logs` table. Status is reported as `succeeded` ONLY after persisted records are confirmed in storage.

---

### 4. Automated Test Evidence

```text
backend/tests/test_gee_contracts.py::test_required_collection_ids_are_registered PASSED
backend/tests/test_gee_contracts.py::test_native_cadence_is_not_coerced_to_daily PASSED
backend/tests/test_gee_contracts.py::test_point_or_buffer_substitute_is_rejected PASSED
backend/tests/test_gee_contracts.py::test_unconfigured_health_is_explicit_and_non_fatal PASSED
backend/tests/test_gee_contracts.py::test_bounded_caching_and_status_semantics PASSED
backend/tests/test_gee_contracts.py::test_distinction_between_authenticated_and_connected PASSED
backend/tests/test_gee_contracts.py::test_raster_tile_coordinate_validation PASSED
backend/tests/test_gee_contracts.py::test_raster_tile_endpoint_returns_503_when_gee_unconfigured PASSED
backend/tests/test_gee_contracts.py::test_raster_tile_endpoint_returns_404_on_invalid_layer PASSED
backend/tests/test_gee_contracts.py::test_raster_tile_endpoint_returns_400_on_invalid_coords PASSED
```
All 10 contract tests passed successfully.

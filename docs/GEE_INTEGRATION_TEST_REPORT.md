# Google Earth Engine Integration Test Report

Test date: 2026-11-01

## Result

The first mandatory live integration slice passed end to end:

`Earth Engine CHIRPS → Beed district polygon aggregation → PostgreSQL/PostGIS → FastAPI → Next.js/Recharts`

This is a bounded historical verification slice, not an operational current-data claim.

## Environment

| Component | Verified configuration |
|---|---|
| Earth Engine project | `gee-pbl` |
| Authentication | Application Default Credentials |
| Collection | `UCSB-CHG/CHIRPS/DAILY` |
| Date interval | 2024-06-01 inclusive to 2024-06-04 exclusive |
| Geography | Stored Beed district MultiPolygon, boundary version `soi-abdb-2025` |
| Database | PostgreSQL 16 with PostGIS 3.4 test container |
| API | `GET /api/satellite/district/beed` |
| Frontend | Next.js App Router production build with Recharts |

No credential value, service-account key, or private path is recorded here.

## Live remote checks

1. `ee.Initialize(project="gee-pbl")` succeeded with ADC.
2. A remote evaluated Earth Engine expression succeeded.
3. CHIRPS returned three native daily acquisitions for the requested interval.
4. Each acquisition retained its actual timestamp and source image ID.
5. Statistics were computed over the stored district polygon, not a point or circular buffer.
6. The persisted rows were retrieved through FastAPI and rendered from the API response.

## Persisted observations

| Acquisition date | District mean | Median | Minimum | Maximum | Valid pixels | Coverage |
|---|---:|---:|---:|---:|---:|---:|
| 2024-06-01 | 0.000 mm/day | 0.000 | 0.000 | 0.000 | 438 / 438 | 100.0% |
| 2024-06-02 | 2.311 mm/day | 0.000 | 0.000 | 24.899 | 438 / 438 | 100.0% |
| 2024-06-03 | 6.091 mm/day | 6.180 | 0.000 | 21.716 | 438 / 438 | 100.0% |

The UI period accumulation is 8.40 mm, calculated from the three district daily means. All rows have `is_demo=false` and `quality_status=source_qa_applied`.

## API evidence

The district observation endpoint returned HTTP 200, `count=3`, and the three values above. The boundary endpoint returned HTTP 200 with a `MultiPolygon` and boundary version `soi-abdb-2025`. `/api/ready` returned HTTP 200 with database connectivity and initialized Earth Engine status.

## Limitations

- This verifies only CHIRPS and one small Beed interval. It does not verify statewide production backfill throughput.
- The coverage count represents pixels at the configured Earth Engine reduction projection/scale; it is not a farm count.
- CHIRPS is a gridded rainfall estimate and is not a substitute for quality-controlled IMD station/gridded observations.
- Historical 2024 observations are displayed as `Historical`, never as current/live.
- The synchronous ingestion path is intentionally capped at 100 features. Large backfills still require Celery/export orchestration, retries, locking and persisted ingestion jobs.

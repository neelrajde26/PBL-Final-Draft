# System Architecture

## Context

The Maharashtra Drought Intelligence System is a modular monolith with independently scalable API and worker processes. It uses one Next.js frontend, one FastAPI codebase, PostgreSQL/PostGIS/TimescaleDB as the system of record, Redis for locks/cache/queues, and Celery workers for GEE and ML jobs.

## Runtime components

| Component | Responsibility |
|---|---|
| Next.js web | Role-aware UI, Recharts, MapLibre/Leaflet layers, downloads and source/freshness disclosure. |
| FastAPI API | Validation, sessions/RBAC, read APIs, job submission, audit logging and OpenAPI. |
| Celery worker | GEE extraction, raster/export tasks, historical ingestion, drought indices and ML training/inference. |
| Celery Beat | Cadence-aware daily polling and scheduled maintenance. It polls daily but never creates observations between native acquisitions. |
| PostgreSQL/PostGIS | Users, boundaries, source registry, observations, indices, events, predictions, alerts and logs. |
| TimescaleDB | Time partitioning and continuous/cached aggregates for high-volume observation series. |
| Redis | Job broker, distributed ingestion locks, rate limits and bounded API response caching. |
| Object storage | Model artifacts, immutable raw manifests, reports and exported rasters. |
| Google Earth Engine | Server-side collection filtering, QA, scaling, temporal composites, polygon reductions and map tiles/exports. |

## Data flow

1. Scheduler determines the last successful acquisition per source.
2. Worker initializes Earth Engine using backend-only credentials.
3. Collection adapter applies product-specific quality masks and scale factors.
4. Worker filters by real acquisition timestamps and versioned district polygons.
5. One batch graph computes district summaries with valid and total pixel counts.
6. Repository upserts idempotently and writes an ingestion log.
7. Index jobs consume stored observations and explicit climatology versions.
8. ML jobs consume versioned feature snapshots; outputs reference their model version.
9. APIs serve stored/cached aggregates and never launch implicit satellite work.

## Package direction

```text
backend/app/
  api/routes/          HTTP contracts only
  core/                settings, security, logging
  data/                stable registries and seed contracts
  db/                  SQLAlchemy models and repositories
  services/gee/        authentication, catalog, QA, extraction, raster, scheduler
  services/indices/    scientific drought calculations
  services/ml/         datasets, training, evaluation, inference, SHAP
  workers/             Celery tasks
frontend/
  app/                  Next.js routes and layouts
  components/           accessible charts, maps and source disclosures
  lib/                  typed API client and auth/session helpers
```

## Boundary policy

- Points and circular buffers are forbidden for district statistics.
- Every observation references the exact boundary version used.
- Only one boundary per district is active for current processing.
- Historic observations are not silently recomputed when a boundary changes.
- Centroids are derived from stored polygons, not manually typed.
- Polygon ingestion validates CRS, topology, district count, name mapping, checksum and area outliers.

## Source and freshness model

Source status is derived from native cadence plus acquisition and ingestion timestamps:

- `RECENT`: newest expected acquisition is present within product-specific latency tolerance.
- `HISTORICAL`: valid observation outside the operational recent window.
- `STALE`: a newer acquisition should exist but has not been ingested.
- `UNAVAILABLE`: no valid stored or live source result.
- `DEMO`: explicitly generated under development demo mode.

`LIVE` is reserved for sources verified by a successful current ingestion, not merely configured credentials.

## Scientific separation

Meteorological, agricultural and hydrological drought are stored and displayed separately. A composite assessment references constituent index records and a method version. Correlated indicators are screened before weights are selected; weights are not embedded in frontend code.

## Security boundaries

- Credentials are read only by backend/worker processes.
- The service-account JSON path is never returned in health output or logs.
- Sessions use secure, HTTP-only, SameSite cookies in deployment.
- Registration defaults to farmer; admin creation is operator-controlled.
- Admin and ingestion actions are audited.
- CORS is an explicit allow-list.
- Farmer coordinates and free text are access-controlled and minimized in exports.

## Failure behavior

- GEE failure does not stop reads of stored observations.
- Failed live refresh marks data stale; it never substitutes synthetic values.
- SHAP failure returns an explanation error, never invented attributions.
- Missing climatology produces an insufficient-data state, not a zero anomaly.
- Background tasks use idempotency keys, bounded retries, jitter and dead-letter review.


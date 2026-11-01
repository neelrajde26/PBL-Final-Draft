# Final Implementation Gap Analysis

Audit date: 2026-11-01; implementation evidence refreshed after the first end-to-end slice.

This matrix reflects the checked-out code and executed tests, not README claims. Both `source-a` and `source-b` are present locally but remain audit inputs rather than deployable application components. The unified application now has a tested FastAPI/PostGIS/GEE foundation and one real Next.js integration screen; it is not yet the complete platform.

| Feature | Existing implementation | Missing implementation | Files affected | Tests required | Completion status |
|---|---|---|---|---|---|
| Prototype audit | Evidence-based audit of both prototypes and their datasets | Revalidate reusable functions when migrated; keep prototype code outside runtime | `docs/EXISTING_PROJECT_AUDIT.md`, `source-a/`, `source-b/` | Migration-specific regression tests | Audited; migration incomplete |
| District registry | 36 stable internal district IDs, current names, aliases and regions | Persisted centroids, talukas and versioned polygons | `backend/app/data/districts.py`, database layer | Registry, alias, seed and geometry tests | Registry complete; spatial data missing |
| District boundaries | Official SoI ABDB source manifest, robust importer, topology/count/extent/checksum validation and 36 stored MultiPolygons | Taluka boundaries, deployment reacquisition workflow and GIS rendering | `backend/app/services/boundaries/`, `backend/data/boundaries/soi_abdb_2025_manifest.json` | CRS, validity, count, overlap, extent and checksum tests | District implementation complete; GIS rendering pending |
| Database schema | Versioned checksum migration runner, native yearly partitions, seed runner, repositories, transactions and idempotent observation upserts | Backup/restore verification, production tuning and optional Timescale evaluation | `backend/migrations/`, `backend/app/db/` | Empty-database migration, seed, upsert, spatial and restore tests | Core path verified; operations incomplete |
| GEE authentication | Lazy ADC/service-account initialization, safe health object and live ADC verification against `gee-pbl` | Production identity validation and CI live-test profile | `backend/app/services/gee/gee_auth.py`, `gee_client.py` | Mock auth plus marked live remote test | ADC verified; production identity pending |
| GEE collection registry | Product IDs, cadence, bands, units and nominal scale are registered | Live catalog validation and correction of all QA/band semantics | `gee_collections.py` | Registry and live band-access tests | Partial |
| Native-cadence extraction | Per-acquisition mapping, source timestamps/IDs, independent per-band QA and area-based coverage; CHIRPS verified | Export jobs, incremental discovery and live checks for all registered products | `gee_processor.py`, `district_extractor.py` | CHIRPS daily, MODIS cadence, coverage and chunk tests | Corrected core; breadth incomplete |
| GEE orchestration | Scheduler interfaces exist | Celery tasks, Redis locks, idempotency, retry/jitter, task monitoring and persisted logs | `gee_scheduler.py`, new worker/tasks | Retry, locking, idempotency and persistence tests | Interface only |
| Raster service | Earth Engine map-tile contract exists | Authorized tile API, cache/expiry policy and live validation | `raster_service.py`, API routes | Tile contract and live smoke tests | Partial |
| Environmental persistence | Repository and bounded ingestion service persist one row per acquisition/variable with idempotent upserts | Job-level audit metadata, bulk-copy path and retention operations | `backend/app/db/repositories.py`, `backend/app/services/gee/ingestion.py` | Duplicate/idempotent ingestion tests | Verified for initial CHIRPS slice |
| Historical ingestion | Prototype datasets audited | Source adapters, immutable manifests, validation, missing-date reports and backfills | New ingestion package | Per-source validation tests | Not implemented |
| Drought indices | None in unified runtime | SPI/SPEI, VCI/TCI/VHI, SSMI/ESI, SRI, anomalies and events with versioned baselines | New `backend/app/services/indices/` | Published numerical fixtures and edge cases | Not implemented |
| ML pipelines | Prototype concepts only | Separate domains, leakage-safe features, baselines, rolling/spatial validation, registry, SHAP and promotion gates | New `backend/app/ml/` | Split, leakage, metric, registry and SHAP tests | Not implemented |
| Authentication | User tables exist in SQL | Argon2 credentials, HTTP-only sessions, CSRF, reset flow, RBAC, bootstrap admin and audit logs | New auth services/routes | Registration, login, reset and role-denial tests | Not implemented |
| Farmer reports and alerts | Tables exist in SQL | Private CRUD/review workflow, alert engine, notifications and multilingual content | New routes/services | Ownership, review, alert and notification tests | Not implemented |
| API surface | Health/readiness, districts, boundary, collection, GEE status/history and stored satellite observation endpoints | Authenticated ingestion jobs, dashboards, history, drought, predictions, models, farmer and admin APIs | `backend/app/api/routes/` | API integration and authorization tests | Initial operational subset |
| Unified frontend | Next.js App Router, Tailwind, typed API client and first real Recharts/provenance/table screen | Complete GIS, auth, public and role portals, historical/model views and component test suite | `frontend/` | Unit, component, browser and visual tests | Initial end-to-end screen verified |
| Data transparency | Source, product ID, cadence, spatial resolution, quality, boundary, freshness, coverage and demo status persist and render on the initial screen | Enforce the same contract platform-wide | Backend schemas/APIs and frontend | Freshness/status contract tests | Verified initial vertical slice |
| Deployment | None | Docker images, Compose, worker/scheduler, CI/CD, health checks, migrations, backups and smoke tests | New deployment files/workflows | Container builds and smoke tests | Not started |

## Verified baseline

- `python -m pytest backend/tests -q` from the repository root: **14 passed** on 2026-11-01.
- `source-a` and `source-b` are present in this workspace but are excluded from the deployable Git tree.
- `.env` remains absent. `.env.example` names `gee-pbl` as a non-secret default and leaves credentials empty.
- `frontend/` exists and its production build, typecheck, lint and three-width visual inspection pass.
- Live GEE, PostGIS migration, Beed persistence/API retrieval and browser QA are documented. Database backup restoration is still unverified.

## Immediate engineering gates

1. Add Celery/Redis orchestration, locks, retries and persisted job logs around the verified bounded ingestion primitive.
2. Run an incremental 36-district CHIRPS batch with rate limits and resumability, then validate missing/duplicate acquisition reports.
3. Implement auth/RBAC before exposing ingestion mutations or admin functions.
4. Add scientifically validated drought indices only after the historical baseline data contracts are enforced.
5. Extend the frontend from the verified slice to district GIS/history and role workflows without page-load Earth Engine computation.

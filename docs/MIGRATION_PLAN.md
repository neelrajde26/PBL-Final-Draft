# Migration and Delivery Plan

## Guiding rules

- One Next.js frontend and one FastAPI backend are the primary applications.
- Dashboards read persisted, indexed aggregates; page loads never trigger expensive Earth Engine reductions.
- Every observation carries source, product, acquisition period, native cadence/resolution, boundary version, coverage and processing metadata.
- Missing live data remains missing or stale. Synthetic data exists only when `DEMO_MODE=true` and is marked `DEMO` in storage and UI.
- Model promotion requires comparison with persistence and climatology baselines. Proxy targets stay labelled as proxy targets.
- Administrative identity is stable even when names or polygons change.

## Phase plan and gates

### Phase 1 - repository audit

Status: complete for the supplied ZIP contents.

Deliverable: `docs/EXISTING_PROJECT_AUDIT.md`.

Gate: architecture and migration decisions cite code/data evidence rather than README claims.

### Phase 2 - architecture and data foundation

Status: started.

Implemented in the first slice:

- 36-district internal registry with renamed-district aliases.
- PostgreSQL/PostGIS/TimescaleDB initial schema.
- District seed script.
- Backend configuration and explicit demo-mode flag.
- Initial FastAPI health, district and collection-registry endpoints.

Remaining gate work:

- Acquire an authoritative/licensed Maharashtra district boundary dataset.
- Record source URL, publication/version date and checksum.
- Reconcile names to internal IDs and validate exactly 36 non-overlapping active districts.
- Load polygons, compute centroids, and run topology/area checks.

### Phase 3 - authentication and authorization

Implement Argon2 password hashing, secure HTTP-only session cookies, CSRF protection, registration with farmer default role, password reset, audit logs and route-level RBAC. Seeded admin creation must be an explicit operator command, never public registration.

Gate: integration tests prove anonymous, farmer, researcher and admin access boundaries.

### Phase 4 - Earth Engine

Status: service contracts started.

Implemented in the first slice:

- Lazy service-account/ADC initialization.
- Non-fatal health reporting when GEE is absent.
- Official collection metadata registry with native cadences.
- Dataset-specific scaling and initial QA masks.
- Polygon-only district extraction contract.
- Mean, median, min, max, valid-pixel count and coverage fields.
- Raster tile service and incremental ingestion orchestration interfaces.

Remaining gate work:

- Install backend dependencies and provide a registered `GEE_PROJECT_ID` plus credentials.
- Verify every band and QA expression with small live queries.
- Persist a real single-district CHIRPS result, then a 36-district batch.
- Add retries with exponential backoff/jitter, Redis locks, idempotency keys and Celery Beat schedules.
- Add export-task handling for computations too large for synchronous evaluation.
- Verify raster tile expiration/refresh and cache policy.

### Phase 5 - historical ingestion

Build source adapters and immutable raw manifests. Import only supplied records with defensible provenance. Do not carry Repository B’s median-filled source gaps into canonical observations. Add duplicate/missing-date/unit/coverage reports and separate source availability intervals.

Gate: a reproducible data-quality report accounts for every imported row and every transformation.

### Phase 6 - scientific indices

Implement SPI/SPEI, VCI/TCI/VHI, SSMI/ESI, SRI and anomaly/event logic. Fit baselines from an explicit reference period using matching calendar month or season. Persist sample size, fit diagnostics and insufficiency flags.

Gate: unit tests against published/reference implementations and edge cases; no index emitted when minimum sample criteria fail.

### Phase 7 - machine learning

Build separate meteorological, agricultural and hydrological datasets and registries. Short-horizon models are disabled until genuine forecast inputs are integrated. Train chronological rolling-origin and spatial-holdout evaluations; compare with climatology and persistence; calibrate probabilities where possible; fail closed if SHAP cannot be calculated.

Gate: no model is promoted without dataset version, target definition, time/spatial split evidence, baseline comparison and model checksum.

### Phase 8 - unified frontend

Create the Next.js application only after stable API contracts exist. Build role-aware routes, accessible loading/error/empty states, source/freshness labels and polygon/raster map layers. Remove all plausible hard-coded fallbacks.

Gate: component and end-to-end tests verify that `UNAVAILABLE`, `STALE`, `HISTORICAL`, `RECENT` and `DEMO` states cannot be confused.

### Phase 9 - farmer portal

Add district/taluka/village/crop profile fields, observations, alert history, Marathi localization and conservative official-advisory links. Reports remain unverified until reviewed. Recommendations remain general unless an official, versioned advisory source supports specificity.

### Phase 10 - integration

Connect pages only to database-backed APIs. Add pagination, filtering, download authorization, Redis response caching and structured logs with request IDs.

### Phase 11 - verification

Run backend, frontend, database, GEE, auth, scientific and ML suites. Produce an acceptance matrix with evidence links and retain failed/blocked items.

### Phase 12 - deployment

Containerize web, API, worker and scheduler separately; deploy managed PostgreSQL/PostGIS and Redis; inject secrets through the platform secret manager; configure backups, migrations, HTTPS, secure cookies, monitoring and runbooks.

## Immediate next implementation sequence

1. Boundary-source selection and versioned polygon ingestion.
2. Database repository layer plus migration execution in a local PostGIS/Timescale instance.
3. Live GEE credential check and a minimal CHIRPS district extraction.
4. Persisted ingestion log and data-source registry seed.
5. Authentication/RBAC foundation.

This order keeps the project focused on real geospatial data and avoids building UI around unverified schemas.


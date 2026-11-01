# Second-Round Gap Analysis

Audit date: 2026-11-01

This report compares the checked-out implementation with the MDIS complete-redesign prompt. It is based on source inspection, the existing test evidence, the current Git state, and the locally retained prototype trees. It does not treat a README claim or a schema-only table as an implemented feature.

## Audit scope and verified baseline

- The deployable repository is clean on `main` and synchronized with `origin/main` at the start of this round.
- Both prototype trees are available locally at `source-a/AI-Drought-Prediction-analysis-main` and `source-b/Indian-Drought-Analysis-main`. They are deliberately ignored by Git and are audit inputs, not runtime dependencies.
- The unified application currently consists of one FastAPI service, one PostgreSQL/PostGIS schema, Earth Engine service primitives, and one Next.js page for a bounded Beed CHIRPS validation interval.
- Existing evidence records 14 passing backend tests, a passing frontend production build, a successful live ADC Earth Engine check against project `gee-pbl`, 36 stored Maharashtra district polygons, and three persisted Beed CHIRPS observations for 2024-06-01 through 2024-06-03.
- That verified slice is historical and narrow. It is not evidence of current statewide monitoring, scheduled ingestion, drought-index production, or operational forecasting.

## What is genuinely implemented

| Area | Verified implementation | Important boundary |
|---|---|---|
| District registry | 36 stable district IDs with names, aliases, regions, and priority flags | Taluka/village registries are absent |
| District geometry | Import, validation, versioning, centroids, checksums, PostGIS storage, and per-district GeoJSON response | The source-derived geometry is local and ignored because redistribution terms are unresolved |
| Database | Idempotent migration runner, PostGIS schema, yearly observation partitions, seeds, repositories, and observation upserts | Several tables are contracts only; their workflows do not exist |
| Earth Engine | Lazy ADC/service-account authentication, health checks, collection metadata, polygon-only extraction primitives, statistics, coverage, raster tile contract, and bounded persistence | Only the CHIRPS/Beed live path has end-to-end evidence |
| API | Health/readiness, district registry, one-boundary lookup, GEE status/collections/history, indicator catalog, and stored district observation series | No dashboard, historical comparison, drought, prediction, auth, farmer, alert, admin, or batch-boundary API |
| Frontend | One server-loaded/client-refreshed Beed rainfall screen with Recharts, provenance, freshness, loading, empty, and error states | Navigation controls are nonfunctional and all other required routes are absent |
| Scientific honesty | The screen labels the observations historical, exposes provenance and coverage, and does not silently substitute synthetic values | This transparency contract is not yet enforced platform-wide |

## Confirmed implementation defects

### Configuration loading

`backend/app/core/config.py` reads `os.getenv` while the module is imported and does not use the installed `pydantic-settings` package or an explicit dotenv loader. A project `.env` file therefore has no effect unless the process launcher loads it independently. The frozen dataclass also makes isolated settings validation and test overrides unnecessarily brittle.

Required correction: implement typed settings with explicit `.env` loading, validation, secret-safe representation, and predictable test overrides. The frontend environment contract must remain separate because only `NEXT_PUBLIC_*` values may reach browser code.

### District boundary truthfulness

`GET /api/districts` and `GET /api/districts/{district_id}` always emit `boundary_available=false`, `boundary_version=null`, and `centroid=null`. This contradicts the active boundaries already stored in PostGIS and the functioning per-district boundary endpoint.

Required correction: make these fields database-backed when the database is available, retain explicit unavailable behavior when it is not, and add a single batched GeoJSON endpoint for the statewide map. The frontend must not issue 36 boundary requests.

### Frontend API coupling

`frontend/lib/api.ts` exposes only a hard-coded `getBeedRainfall` function with fixed dates and district. Runtime JSON is cast directly to a TypeScript type without validation. There is no common error envelope, pagination contract, request timeout, district API, boundary API, or freshness classifier.

Required correction: add typed, reusable request functions and schema validation at the API boundary. Filters must be URL-driven and data must continue to come from FastAPI/PostGIS rather than client-side fallback arrays.

### Navigation and route semantics

The current rail renders buttons that do not navigate. Disabled tabs imply functionality that has not been implemented. There is no public shell, authenticated shell, route protection, or role-aware navigation.

Required correction: implement real Next.js routes and links. Unimplemented destinations must not be presented as working controls.

### Visual system mismatch

The current `data-terminal` screen uses neutral black surfaces and a blue accent. The redesign prompt fixes a new MDIS palette: Midnight Abyss `#071D2C`, Aqua Jade `#54D6BD`, Baby Pink `#F4BBD0`, Deep Ocean `#102C3C`, Raised Ocean `#193B4A`, Border `#28505C`, and the specified text tiers. The current UI also relies on resting shadows and does not provide the required map-led identity.

Required correction: deal a new app-screen direction with the supplied palette and typography held fixed, then implement a restrained monitoring shell where colour is concentrated on data, severity, status, and the one primary action.

## Requirement matrix

| Required capability | Current state | Evidence / gap | Next verification gate |
|---|---|---|---|
| Statewide executive dashboard | Not implemented | One Beed rainfall page only | Database-backed statewide summary and browser test |
| Interactive Maharashtra GIS | Not implemented | Per-district GeoJSON API exists; no map library or batch endpoint | Batched FeatureCollection, real polygon render, layer/filter interaction tests |
| District explorer | Not implemented | Stored observation endpoint is district-addressable but frontend is fixed to Beed | URL-selected district and indicator series |
| Historical comparison | Not implemented | No comparison endpoints or UI | Validated period/district comparison APIs and charts |
| Live satellite monitoring | Partial | GEE health and stored CHIRPS slice work | Native-cadence ingestion/status for more products with no page-load reductions |
| Scheduled statewide ingestion | Interface only | No Celery task graph, Redis lock, Beat schedule, persisted retry workflow, or 36-district batch evidence | Resumable incremental CHIRPS run across all districts |
| Raster visualization | Contract only | Earth Engine tile helper is not exposed as a secured, cached application workflow | Authorized tile endpoint with expiry/cache tests |
| Drought indices | Not implemented | Tables only | Reference-fixture tests for SPI/SPEI and calendar-matched vegetation/soil indices |
| Drought events/composite | Not implemented | Tables only | Versioned methods, correlation review, event fixtures |
| Meteorological ML | Not implemented | No unified feature/training/inference code | Rolling-origin and spatial-holdout evaluation against baselines |
| Agricultural ML | Not implemented | No unified feature/training/inference code | Same, with proxy labels clearly marked |
| Hydrological ML | Not implemented | No unified feature/training/inference code | Same, respecting GRACE scale limitations |
| 7/15-day forecasts | Blocked by missing forecast source | Historical observations alone are insufficient | Integrate and validate a genuine weather-forecast input first |
| SHAP | Not implemented | No fail-closed explanation pipeline | Explanation artifact and API tests |
| Authentication | Not implemented | User/reset tables only | Registration, login, logout, reset, secure-cookie and CSRF integration tests |
| RBAC | Not implemented | No authorization dependency or protected routes | Anonymous/farmer/researcher/admin denial matrix |
| Farmer reports | Schema only | No private CRUD, ownership, review, or UI | Ownership and review workflow tests |
| Alerts | Schema only | No engine, publication, notifications, or UI | Trigger provenance and role authorization tests |
| Dataset management | Not implemented | Source seeds and indicator listing only | Admin-only source, quality, ingestion, and download workflows |
| Public methodology/data pages | Not implemented | Documentation exists outside the app | Accessible public routes linked to source registry |
| Responsive role portals | Not implemented | One responsive screen only | Route-level 1440/768/390 inspection and workflow tests |
| Multilingual support | Not implemented | No locale routing or Marathi copy | Translation review and locale tests |
| Deployment | Not implemented | No containers, Compose, worker, CI, backup, or production runbook | Clean environment deployment smoke test |

## Prototype disposition

Repository A remains useful as evidence for VHI-oriented interactions, farmer reporting semantics, GeoTIFF inspection, and an actual Earth Engine tile/statistics attempt. Its point-buffer geography, absent QA, short/global climatology, incomplete JavaScript dependency tree, and weak model validation prevent direct reuse.

Repository B remains useful as an information-architecture and modeling reference: historical analysis, lag/rolling concepts, baseline algorithm comparison, model metadata, prediction history, and real SHAP code paths. Its simulated GEE responses, multi-year median filling, leakage-prone climatologies, mismatched frontend/backend contracts, and proxy score called probability must not enter the unified runtime.

No second primary frontend will be retained. Reuse is limited to independently reimplemented concepts with new tests and provenance.

## Ordered implementation plan

1. **Correct configuration and spatial API contracts.** Typed `.env` loading, truthful district metadata, batched FeatureCollection, API tests, and documentation.
2. **Build the GIS-first shell.** Generate the required app direction, adopt the fixed palette, add MapLibre, create real routes, and connect the statewide polygon map to stored data.
3. **Productionize ingestion.** Celery/Redis task execution, locks, retries, schedules, logs, incremental discovery, and a verified 36-district CHIRPS batch.
4. **Add historical and quality pipelines.** Source adapters, manifests, duplicate/missing-date checks, aggregation tables, and data-quality APIs.
5. **Implement scientific indices.** Versioned reference periods, adequacy flags, numerical fixtures, and separate drought domains.
6. **Implement authentication and role workflows.** Secure sessions, CSRF, reset, RBAC, audit logging, farmer reports, and admin/researcher portals.
7. **Implement leakage-safe ML.** Three domain pipelines, baselines, rolling/spatial evaluation, calibration, registry, fail-closed SHAP, and stored predictions.
8. **Complete routes, alerts, reporting, deployment, and acceptance verification.** Every status remains evidence-based; unavailable live inputs remain unavailable rather than synthetic.

## Phase-one conclusion

The existing CHIRPS vertical slice is worth preserving, but the application is not close to the complete platform described in the redesign prompt. The next safe implementation boundary is configuration plus statewide boundary APIs, followed by a real polygon map. Building additional decorative dashboard screens before those contracts are corrected would compound known defects.

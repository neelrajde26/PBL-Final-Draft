# Incremental Test Report

Report date: 2026-11-01

## Existing repositories

| Check | Result | Evidence |
|---|---|---|
| Repository A index/ML scripts | Pass | Reproduced 36 derived rows and RF metrics RMSE 11.29, MAE 8.98, R2 about 0.84. |
| Repository A pytest | Fail | Two collection errors: `ModuleNotFoundError: ee`. |
| Repository A Express start | Fail | Incomplete supplied dependency tree; missing `csvtojson/index.js`. |
| Repository B pytest | Fail | 8 passed, 1 failed; GLDAS aggregation loses the date grouping column. |
| Repository B FastAPI import | Fail | `ModuleNotFoundError: shap` in active environment. |
| Repository B Next.js production build | Pass with warnings | 13 static routes built; package installation reported 4 vulnerabilities. |

## New platform tests

Run from `backend`:

```powershell
python -m pytest
```

The initial suite covers:

- Exactly 36 unique districts and expected region counts.
- Renamed district aliases.
- Required Earth Engine collection IDs and native cadence contracts.
- Rejection of point geometry as a district boundary.
- Non-fatal, explicit unconfigured GEE health.
- Health, district and collection-registry API contracts.

Current unified suite result: **14 passed**. Live external checks are recorded separately in `GEE_INTEGRATION_TEST_REPORT.md`; they are not disguised as hermetic unit tests.

## Master acceptance status

| # | Criterion | Status |
|---:|---|---|
| 1 | Both projects audited | PASS |
| 2 | Valuable functionality migrated | IN PROGRESS |
| 3 | Login and registration work | NOT STARTED |
| 4 | Role permissions work | NOT STARTED |
| 5 | All 36 district records exist | PASS - REGISTRY AND TEST DATABASE |
| 6 | Actual district boundaries render | IN PROGRESS - 36 MULTIPOLYGONS STORED AND BOUNDARY API VERIFIED; GIS RENDERING NOT BUILT |
| 7 | GEE authentication works with supplied credentials | PASS - ADC REMOTE EVALUATION AGAINST `gee-pbl` |
| 8 | One live GEE dataset queried end-to-end | PASS - CHIRPS/BEED/2024-06-01..03 |
| 9 | District statistics generated | PASS - MEAN/MEDIAN/MIN/MAX/VALID COUNT/COVERAGE |
| 10 | Observations stored in database | PASS - THREE NON-DEMO ROWS PERSISTED |
| 11 | Historical charts use stored data | PASS FOR INITIAL BEED CHIRPS SCREEN |
| 12 | Drought indices correct | NOT STARTED |
| 13 | Model training runs | NOT STARTED FOR NEW PLATFORM |
| 14 | Chronological validation works | NOT STARTED FOR NEW PLATFORM |
| 15 | Predictions generated | NOT STARTED FOR NEW PLATFORM |
| 16 | SHAP works | NOT STARTED FOR NEW PLATFORM |
| 17 | Prediction history stored | SCHEMA IMPLEMENTED; NOT EXECUTED |
| 18 | Data freshness visible | PASS FOR INITIAL SCREEN; PLATFORM-WIDE COVERAGE IN PROGRESS |
| 19 | Demo distinguishable from live | PASS FOR INITIAL SCREEN; ZERO DEMO ROWS AND NO SILENT FALLBACK |
| 20 | Important APIs automated | IN PROGRESS - 14 BACKEND TESTS; BROADER AUTH/ML/JOB COVERAGE MISSING |

No partial item above is counted as complete.


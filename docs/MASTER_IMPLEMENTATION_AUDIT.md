# Master Implementation Audit (2026-11-05)

Branch `redesign/mdis-v2`. This audit was made from source code and runs, not from the earlier
reports in `docs/`, several of which describe work as complete that the code does not support.

## Headline findings

| # | Area | Finding | Severity | Status |
|---|------|---------|----------|--------|
| 1 | Data | `backend/data/processed/maharashtra_drought_features_2000_2023.csv` is **synthetic**. `backend/app/ml/train.py::generate_district_historical_timeseries` draws rainfall, LST, NDVI and soil moisture from `numpy.random` with hand-picked "drought years". | Critical | Not used by any API any more. File kept, unmodified, for the record. |
| 2 | ML | The three shipped models (`models/mdis_*_v1.joblib`) were trained on that synthetic data. Their reported metrics (accuracy 0.93–0.97) say nothing about real drought. | Critical | Registry status set to `retired_synthetic_training_data`. Replaced by `app/ml/pipeline.py`. |
| 3 | API | `GET /predictions` invented probabilities from a fixed region table (Marathwada 0.64, …) and labelled them "Trained ML Ensemble", `is_demo: false`. | Critical | Removed. Serves pipeline forecasts or `status: awaiting_pipeline`. |
| 4 | API | `alert_engine` seeded three fixed alerts (Beed "VHI 26.8", Dharashiv, Solapur) on every start. | Critical | Removed. Alerts now come only from measured SPI-3 / VHI thresholds. |
| 5 | API | `maps/district-indicators`, `drought/indices`, `drought/district/{id}`, `historical/series` fell back to the synthetic CSV and labelled values "verified_historical"; `historical/series` also invented min/max (value x0.9 / x1.1), pixel counts (1420) and coverage (98.5%). | High | Replaced by `app/services/store.py` reading Earth Engine extracts; empty → `awaiting_ingestion`. |
| 6 | GIS | MapLibre's web worker failed to load under Turbopack, so the GIS map never drew polygons ("dark background only"). No basemap was configured. | High | Fixed with `setWorkerUrl` + copied worker; Sentinel-2 cloudless basemap (EOX, CC BY 4.0) added. |
| 7 | GEE | No live Earth Engine query had ever succeeded. `gee-pbl` project not accessible to the current account. | High | Bulk extractor + sync CLI implemented and tested up to auth; blocked on project registration (see KNOWN_LIMITATIONS). |
| 8 | Backend | With PostgreSQL absent, every request waited 2–4 s for a refused connection (Windows retries), pushing parallel calls past the 8 s client timeout. | Medium | 0.3 s TCP probe + 60 s circuit breaker in `app/db/session.py`. |
| 9 | Frontend | Body text 12–14 px, many labels 10–11 px; default language Marathi; static green "Live" badge. | Medium | Type floor raised app-wide; English default; status reflects `/ready` and sync history. |
| 10 | Frontend | Farmer "prediction" is a fixed-weight checklist, not a model. | Low | Response now states `method: rule_based_field_checklist`. |
| 11 | Docs | `FINAL_ACCEPTANCE_REPORT.md`, `FINAL_MASTER_AUDIT.md` etc. claim completion of items listed above as broken. | Medium | Superseded by this file; left in place for history. |

## Leakage review

The variables named in the brief (`combined_stress_anomaly`, `gldas_stress_anomaly`,
`grace_stress_anomaly`, `water_stress_label`) do not exist anywhere in this repository; the
original modelling CSV that contained them was never committed. In the synthetic dataset the
targets were defined from next-month SPI-3 / VHI / soil-moisture anomaly, i.e. not leaked, but the
data itself is not real, so the question is moot for it.

The new pipeline guards against leakage by construction:
- features use months <= t only; targets are month t+1 and only when t+1 is the next calendar month;
- SPI gamma parameters, VCI/TCI min-max and anomaly climatologies are fitted on training years only;
- model choice and decision threshold use validation years; test years are scored once;
- the backtest refits each January on targets that ended before that date (`tests/test_real_pipeline.py` asserts it).

## Verification

- `backend`: `python -m pytest` → 55 passed (includes pipeline + causality tests).
- `frontend`: `tsc --noEmit` clean; `eslint` 0 errors (19 pre-existing warnings in old pages).
- All 19 routes return 200 in dev. Map, Overview and Backtesting checked visually in headless Chrome
  against a generated test fixture (never committed).

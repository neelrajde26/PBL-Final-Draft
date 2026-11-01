# Existing Project Audit

Audit date: 2026-11-01  
Target system: Maharashtra Drought Intelligence System  
Audited inputs:

- `source-a/AI-Drought-Prediction-analysis-main`
- `source-b/Indian-Drought-Analysis-main`

## Audit method

The review covered first-party Python, JavaScript, JSX and TypeScript; API routes; model scripts and serialized artifacts; CSV, XLSX, JSON and GeoTIFF assets; dependency manifests; documentation; and runnable checks. Committed dependency and generated build folders were excluded from architectural file counts. README claims were compared with code, data and test output.

The following checks were executed:

- Repository A drought-index and ML scripts: ran successfully and reproduced RMSE `11.29`, MAE `8.98`, and R2 approximately `0.84` on 11 test months.
- Repository A Python tests: collection failed because `earthengine-api` (`ee`) is not installed in the active environment.
- Repository A Node server: startup failed because the supplied dependency tree is incomplete (`csvtojson/index.js` is missing). There is no client or server `package.json` in the ZIP.
- Repository B Python tests: `8 passed, 1 failed`; GLDAS preprocessing raises `KeyError: 'date'` with the installed Pandas behavior.
- Repository B FastAPI import: failed because `shap` is not installed in the active environment, despite being declared.
- Repository B Next.js: dependencies installed and `npm run build` completed successfully for 13 static routes. Installation reported four dependency vulnerabilities: one moderate, two high, and one critical. Runtime API field mismatches described below are not caught because pages use `any`.

No Google Earth Engine credential was supplied. Live authentication and live data access therefore were not claimed or tested.

## Repository A: AI-Drought-Prediction-analysis

### Existing architecture

Repository A contains three overlapping application paths:

1. A root Streamlit application reading generated CSVs.
2. A Vite/React dashboard using Recharts, React-Leaflet and a local GeoTIFF.
3. An Express server serving CSV data, farmer reports and one Earth Engine tile endpoint.

Python scripts separately produce monthly Beed data, VCI/TCI/VHI, a next-month Random Forest regression evaluation, and feature importance.

### Implemented features

- A 36-row Beed monthly table covering January 2021 through December 2023 with NDVI, LST and ET.
- VCI, TCI and VHI derivation and VHI threshold classification.
- A chronological split with 2021-2022 used for training and 11 months of 2023 used for evaluation.
- A Random Forest next-month VHI regression and exported evaluation pairs.
- React charts, date filters, CSV summary export and a data-quality summary.
- Local GeoTIFF parsing and display with raw-value legend and honest warnings about unknown class encoding.
- Farmer observation submission and review status using local JSON storage, input validation and atomic file replacement.
- English/Marathi farmer-page copy and links to official IMD/ICAR resources.
- A real Earth Engine initialization path in the Express server using a backend service-account key path.
- A real Earth Engine map-tile path that computes an experimental annual VHI classification.

### Data and geographic coverage

| Asset | Observed content | Coverage | Provenance status |
|---|---:|---|---|
| `beed_monthly_data.csv` | 36 rows, 5 columns | Beed-like 50 km buffer, 2021-2023 monthly | Generation code points to MODIS GEE collections, but the CSV has no source IDs, acquisition timestamps, QA, valid-pixel counts or extraction log. |
| `beed_drought_analysis.csv` | 36 rows, 11 columns | Same period | Derived locally from the preceding file. |
| `prediction_results.csv` | 11 rows | 2023 evaluation inputs; targets end in December 2023 | Model evaluation artifact, not a future forecast. |
| GeoTIFF | 106 by 101, EPSG:4326, about 1 km pixels | Bounds 75.279E-76.231E and 18.532N-19.440N | Observation date, product, processing method and class meanings are absent. Valid pixels contain values 1 (4,853 pixels) and 2 (13 pixels); 0 is tagged NoData. |

The code does not use an administrative Beed polygon. It uses `Point([75.756, 18.989]).buffer(50000)`, so statistics and tiles include land outside Beed and omit parts depending on the buffer geometry.

### Earth Engine status

The integration is partially real but not production-ready.

- Python uses `MODIS/061/MOD13A1`, `MODIS/061/MOD11A1` and `MODIS/061/MOD16A2`.
- Express uses the same NDVI/LST sources to create an annual VHI tile.
- NDVI, LST and ET scale factors are applied.
- Credentials remain backend-side.

Material limitations:

- The study geometry is a point buffer, not a district polygon.
- No MODIS QA bits are applied.
- There are no valid-pixel counts, coverage percentages, acquisition dates or freshness records.
- The baseline is only 2018-2023 and pixelwise extrema are not matched by calendar month or season.
- `monthly_data.py` makes 36 sequential `getInfo()` calls and has no retry, rate-limit, cache or incremental-ingestion strategy.
- MOD16 composites are grouped by image timestamp without accounting for composite periods crossing month boundaries.
- The Python project ID and one test project ID are hard-coded. The Node test also contains a developer-specific absolute key path, although not the key itself.
- Only service-account authentication is implemented in Node; ADC is not.
- No extraction result is stored in a database.

### Model limitations

- Only 24 training samples and 11 test samples are used.
- VCI and TCI use one global minimum and maximum over all months and years, rather than district-specific, calendar-matched climatology.
- Current VCI, TCI and VHI are used to predict next-month VHI. These are algebraically related predictors and a target derived from the same short series.
- The high R2 is not supported by rolling-origin validation, spatial holdout, persistence/climatology baselines, uncertainty intervals or an independent drought target.
- The UI originally contains fixed model metrics, although the React evaluation panel also recalculates metrics from the supplied CSV.
- No saved model artifact, version metadata, training dataset checksum or inference service exists.

### Bugs and incomplete areas

- Missing `package.json` files make both JavaScript applications non-reproducible from the ZIP.
- Committed `node_modules` is incomplete and the Express server does not start.
- Python files named as tests are execution scripts rather than isolated pytest tests and require live credentials during collection.
- No authentication or authorization protects farmer-report review.
- CORS is unrestricted.
- API URLs are hard-coded to localhost in the frontend.
- Only Beed is supported; no state-wide registry or boundaries exist.

### Components worth reusing conceptually

- The backend-only credential rule and Earth Engine map-tile approach.
- The farmer observation field validation and explicit “reviewed is not verified” semantics.
- The GeoTIFF metadata inspection and raw-value legend behavior.
- The React date filtering, metric recalculation and CSV export patterns.
- The clear distinction between historical observations and experimental evaluation outputs.

The code should be rewritten into the unified architecture rather than copied wholesale.

## Repository B: Indian-Drought-Analysis

### Existing architecture

Repository B contains two primary frontends:

1. A feature-rich Streamlit application under `app.py` and `pages/`.
2. A Next.js 14 App Router frontend under `frontend/`.

It also contains a FastAPI backend, a parallel `src/` service layer used by Streamlit, two sets of model artifacts, raw environmental/agricultural assets, processed datasets, and local JSON/MongoDB prediction-history paths. Logic is duplicated between `src/` and `backend/app/services/`.

### Implemented features

- GLDAS and GRACE file loaders, daily deduplication intent, monthly aggregation, lag/rolling features and month-specific anomaly features.
- A documented proxy water-stress score and a visible disclaimer that proxy labels are not independently validated ground truth.
- Next-period target shifting within district groups.
- Random Forest and Logistic Regression classifiers with chronological partitions in the training script.
- Serialized models, model comparison, feature importance, metadata and SHAP importance artifacts.
- Real SHAP code paths for tree and linear models.
- Historical, prediction, satellite, risk-map and history API route modules.
- Next.js static production build with dashboard, historical, prediction, satellite, methodology and source pages.
- Streamlit historical analysis, prediction, SHAP and Folium centroid-map views.
- MongoDB-or-local-JSON prediction history.

### Dataset inventory and provenance

| Asset | Verified shape / coverage | Audit finding |
|---|---|---|
| GLDAS 2000-2002 XLSX | 236,709 daily rows, 25 named districts, 2000-01-01 to 2002-12-31 | `source=GLDAS`; no collection ID, band name, unit, polygon version, extraction scale or source URL embedded. One exact duplicate. |
| GLDAS 2018-2023 CSV | 473,256 daily rows, same 25 districts | `source=GLDAS_Recent`; same provenance gaps. Seven exact duplicates. |
| GRACE 2003-2008 CSV | 1,917 rows, 25 districts | Monthly-like dates include irregular dates; collection/product and spatial limitations are not recorded. |
| GRACE 2009-2017 CSV | 2,187 rows, 25 districts | Ends at 2017-01-07, not 2023. |
| Combined monthly table | 6,375 rows, 255 unique dates | Not 6,375 rows over 288 months as documentation claims. Every row is missing either GLDAS or GRACE; the two sources never overlap in this table. |
| Feature table | 6,375 rows | Missing source gaps are filled with global medians, creating apparent values for years where that variable is absent. |
| Modeling table | 6,350 targetable rows | Uses the imputed features and proxy targets. |
| CHIRPS workbook | 4,380 daily rows, 2020-2023, three regions | Regional rather than district data; `.geo` contains empty multipoints. It is not integrated into the application pipeline. |
| NDVI workbook | 1,522 combined regional records across MODIS/Landsat, 1998-2013 | Workbook metadata says GEE regional averages. No asset IDs, extraction geometry, QA recipe or execution log. Not integrated into production APIs. |
| SPEI workbooks | 287 Marathwada and 288 Bundelkhand values | Regional, not district data; provenance and computation parameters are absent. Not integrated. |
| NWIC soil-moisture workbooks | 2018-07 to 2025-06 exports | Multi-row headers require a specific parser; current loaders do not ingest these files. |
| ICRISAT CSV | 520 rows, 10 districts, 80 columns | Agricultural statistics are not used by the model or API. Beed is not present in the inspected district sample. |

The 25 historical model districts span Marathwada, Bundelkhand and eastern Tamil Nadu. Beed is absent. Only seven historical Maharashtra/Marathwada names appear, and old names such as Aurangabad and Osmanabad are not reconciled with current district identities. No administrative boundary asset exists.

### Earth Engine status

Repository B does not implement a working Earth Engine query.

- `backend/app/services/gee_service.py` reports “Connected” when an environment string is non-empty; it does not import, initialize or query Earth Engine.
- `src/gee_service.py` imports Earth Engine conditionally, calls `ee.Initialize()` without using the configured service-account object, creates a Beed point, then executes `pass`.
- Both paths return deterministic NumPy-generated NDVI/LST/ET curves for 2020-2024.
- Synthetic records are labelled “Validation Asset,” “MODIS / Sentinel,” and in places “validated project baseline data.” No validation asset is present.
- There is no polygon extraction, raster output, source QA, freshness, persistence, batch processing or scheduler.

This is the most important non-reusable part of Repository B.

### Model and scientific limitations

- The proxy score is used both to construct labels and to describe predictions. It is not independent drought ground truth.
- `calculate_proxy_risk` returns its severity score in a field named `probability`, although that score is not calibrated probability.
- The feature pipeline fills entire multi-year missing-source blocks with global medians. Consequently, models see fabricated GLDAS values for 2003-2017 and fabricated GRACE values for 2000-2002 and 2018-2023.
- Climatological means and standard deviations are computed across the full dataset before chronological splitting. Test-period information therefore influences anomaly features.
- Missing values are filled using medians calculated over all districts and dates, also before splitting.
- The main trainer uses a chronological split, but another training path silently falls back to random stratified splitting if sample checks fail.
- There is no rolling-origin backtest, spatial holdout, persistence/climatology baseline, Brier score, probability calibration or regression pipeline.
- Model metrics are internally inconsistent: backend artifacts report RF accuracy `0.7323` and macro F1 `0.4865`; root artifacts report accuracy `0.7506` and macro F1 `0.6032`; documentation cites both families of values.
- Serialized artifacts were created with Scikit-learn 1.8.0 and emit compatibility warnings in the installed 1.6.1 environment.
- Backend SHAP catches every error and returns invented `0.01 * feature_value` attributions. This can silently present synthetic explanations as SHAP and must not be reused.
- The model predicts one next monthly proxy class only; it does not implement 7-day, 15-day, 30-day, 3-month or 6-month operational horizons.

### API and frontend defects

- There is no authentication, registration, password reset, session management or RBAC.
- FastAPI allows `*` CORS together with credentials.
- FastAPI cannot import in the audited environment because SHAP is imported eagerly.
- Next.js district types expect `latitude`, `longitude` and `focal`; the API returns `lat`, `lon` and `has_historical_data`.
- The risk-map page calls `.toFixed()` on `m.latitude` and reads `gldas_zscore`, but the API returns `lat`, `lon` and no z-score. This is a runtime failure hidden by `any`.
- Satellite charts request fields `lst` and `et`; the API returns `lst_celsius` and `et_mm`, so those lines do not render.
- Satellite KPI values and anomaly text are hard-coded.
- The dashboard falls back to plausible hard-coded hydrology values when data are absent and calls the historical feed “real-time.”
- The “risk map” in Next.js is a card grid; the Streamlit version is centroid circles, not district polygons.
- Local JSON writes have no inter-process locking and are not a production datastore.

### Components worth reusing conceptually

- FastAPI route/service separation and the Next.js App Router direction.
- The proxy-ground-truth disclaimer and distinction between Beed satellite focus and absent Beed history.
- Per-district lag and rolling-feature concepts after leakage-safe redesign.
- Chronological target alignment, model metadata, feature schema and artifact checksum concepts.
- Random Forest versus Logistic Regression baseline comparison.
- Real SHAP paths, but only with fail-closed behavior.
- Historical explorer, source registry, model comparison and prediction-history information architecture.
- MongoDB/local interfaces as design references only; the target system will use PostgreSQL/PostGIS.

## Cross-repository conclusion

Neither repository is a state-wide operational drought platform. Repository A provides the stronger proof that Earth Engine can produce statistics and tiles, but only for an approximate Beed buffer. Repository B provides the stronger API/ML/dashboard structure, but its live satellite integration is simulated and its model table contains scientifically invalid multi-year median substitutions.

The unified system should therefore reuse interaction patterns and small isolated algorithms, not either repository as its foundation. The highest-risk items to rebuild are:

1. Versioned Maharashtra district polygons and identifiers.
2. Real backend Earth Engine authentication, collection-specific QA and batched polygon extraction.
3. Observation provenance, freshness and persistence.
4. Leakage-safe climatologies and drought indices.
5. Separate meteorological, agricultural and hydrological model targets with honest validation.
6. Database-backed authentication and authorization.

## Explicit non-claims

- No supplied credential was used or retained.
- No live Earth Engine dataset was queried during this audit.
- The raw GLDAS/GRACE files may contain genuine source-derived values, but their provenance cannot be independently verified from the supplied repositories alone.
- The supplied GeoTIFF cannot be assigned a drought meaning or date from its embedded metadata.
- No acceptance criterion requiring actual state-wide boundaries, database persistence, live GEE, authentication or trained new models is complete yet.


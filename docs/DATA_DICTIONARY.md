# MDIS Data Dictionary
## Maharashtra Drought Intelligence System

This document specifies the exact schema, data types, physical units, coordinate reference systems (CRS), and semantic constraints for all database tables, Earth observation extractions, and model artifacts in MDIS.

---

### 1. Spatial Reference Standards
- **Standard Storage Projection:** `EPSG:4326` (WGS 84 Ellipsoid).
- **Planar Area / Distance Projections:** `EPSG:32643` (UTM Zone 43N) for Western/Central Maharashtra, `EPSG:32644` (UTM Zone 44N) for Eastern Vidarbha.
- **Administrative Boundary Format:** GeoJSON MultiPolygon with zero self-intersections (`ST_IsValid = TRUE`).

---

### 2. Core PostgreSQL / PostGIS Schema

#### Table: `districts`
Authoritative administrative registry for Maharashtra’s 36 districts.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(32)` | `PRIMARY KEY` | Stable slug identifier (e.g. `beed`, `dharashiv`, `solapur`). |
| `code` | `VARCHAR(8)` | `UNIQUE, NOT NULL` | Standard ISO/LGD administrative code (e.g. `MH-BD`). |
| `name` | `VARCHAR(64)` | `NOT NULL` | Official administrative name in English. |
| `region` | `VARCHAR(32)` | `NOT NULL` | Revenue division (`Marathwada`, `Vidarbha`, `Western Maharashtra`, `North Maharashtra`, `Konkan`). |
| `legacy_names` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Historical or colloquial names (e.g. `["Bhir"]` for Beed, `["Osmanabad"]` for Dharashiv). |
| `is_priority` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag for chronic drought-prone districts under DPAP criteria. |
| `boundary_version` | `VARCHAR(32)` | `NULLABLE` | Version string of imported boundary geometry (e.g. `2024.1`). |
| `boundary_available` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Indicates whether genuine MultiPolygon geometry is stored. |
| `centroid` | `GEOMETRY(Point, 4326)` | `NULLABLE` | Geographic center of mass for map labeling and point extraction. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record insertion timestamp. |

#### Table: `district_boundaries`
Exact PostGIS versioned MultiPolygon geometries.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `district_id` | `VARCHAR(32)` | `PRIMARY KEY, FK -> districts.id` | Associated district foreign key. |
| `geometry` | `GEOMETRY(MultiPolygon, 4326)` | `NOT NULL` | PostGIS MultiPolygon feature boundary. |
| `boundary_version` | `VARCHAR(32)` | `NOT NULL` | Importer revision tag. |
| `source_name` | `VARCHAR(128)` | `NOT NULL` | Authoritative cartographic source (e.g. Survey of India / GADM 4.1). |
| `checksum_sha256` | `CHAR(64)` | `NOT NULL` | Cryptographic SHA-256 hash of geometry WKT. |
| `stored_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Import timestamp. |

#### Table: `environmental_observations`
Zonal reductions of native satellite rasters over district boundaries.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique observation row identifier. |
| `district_id` | `VARCHAR(32)` | `NOT NULL, FK -> districts.id` | District identifier. |
| `variable_key` | `VARCHAR(32)` | `NOT NULL` | Standard variable key (`rainfall`, `ndvi`, `evi`, `lst_day`, `lst_night`, `soil_moisture`, `runoff`). |
| `source_key` | `VARCHAR(32)` | `NOT NULL` | Mission key (`chirps`, `mod13q1`, `mod11a2`, `smap`, `era5`). |
| `observation_time` | `TIMESTAMPTZ` | `NOT NULL` | Acquisition start timestamp. |
| `period_start` | `TIMESTAMPTZ` | `NOT NULL` | Composite period start. |
| `period_end` | `TIMESTAMPTZ` | `NOT NULL` | Composite period end. |
| `mean_value` | `DOUBLE PRECISION` | `NULLABLE` | Unweighted spatial mean across valid pixels in district polygon. |
| `median_value` | `DOUBLE PRECISION` | `NULLABLE` | 50th percentile value. |
| `minimum_value` | `DOUBLE PRECISION` | `NULLABLE` | Minimum valid pixel value. |
| `maximum_value` | `DOUBLE PRECISION` | `NULLABLE` | Maximum valid pixel value. |
| `valid_pixel_count` | `INTEGER` | `NULLABLE` | Count of cloud-free, QA-passing pixels. |
| `total_pixel_count` | `INTEGER` | `NULLABLE` | Total potential pixel raster grid cells intersecting polygon. |
| `coverage_percentage` | `DOUBLE PRECISION`| `NULLABLE` | Valid pixel ratio: `100 * (valid / total)`. |
| `unit` | `VARCHAR(32)` | `NOT NULL` | Physical engineering unit (`mm/day`, `dimensionless`, `Kelvin`, `m3/m3`). |
| `quality_status` | `VARCHAR(32)` | `NOT NULL` | Data flag (`OPERATIONAL`, `PROVISIONAL`, `DEGRADED`, `DEMO_HISTORICAL`). |
| `is_demo` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag for test data. In production, must remain FALSE. |
| `ingested_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Pipeline ingestion timestamp. |

#### Table: `drought_indices`
Computed scientific standardized drought index values.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique index value record identifier. |
| `district_id` | `VARCHAR(32)` | `NOT NULL, FK -> districts.id` | District identifier. |
| `index_key` | `VARCHAR(16)` | `NOT NULL` | Indicator slug (`spi_1`, `spi_3`, `spi_6`, `spei_3`, `vci`, `tci`, `vhi`, `ssmi`). |
| `drought_domain` | `VARCHAR(32)` | `NOT NULL` | Domain (`meteorological`, `agricultural`, `hydrological`). |
| `observation_date` | `DATE` | `NOT NULL` | Evaluation date. |
| `accumulation_months` | `SMALLINT` | `NOT NULL` | Integration window (1, 3, 6, 12). |
| `value` | `DOUBLE PRECISION` | `NOT NULL` | Standardized z-score or percentile (e.g. -1.84 for severe SPI). |
| `category` | `VARCHAR(32)` | `NOT NULL` | Category (`Extreme Drought`, `Severe Drought`, `Moderate Drought`, `Normal`, `Wet`). |
| `method_version` | `VARCHAR(16)` | `NOT NULL` | Algorithm revision (`1.0.0`). |

#### Table: `prediction_results`
Machine learning operational forecast probability estimates.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Prediction inference record ID. |
| `model_id` | `VARCHAR(64)` | `NOT NULL, FK -> model_registry.id` | Reference to model artifact. |
| `district_id` | `VARCHAR(32)` | `NOT NULL, FK -> districts.id` | Forecast district target. |
| `forecast_horizon` | `VARCHAR(8)` | `NOT NULL` | Target horizon (`30d`, `3m`, `6m`). Note: `7d` and `15d` disabled. |
| `target_start` | `DATE` | `NOT NULL` | Start date of forecast verification interval. |
| `target_end` | `DATE` | `NOT NULL` | End date of forecast verification interval. |
| `probability` | `DOUBLE PRECISION` | `NOT NULL` | Calibrated predicted probability of drought $[0.0, 1.0]$. |
| `risk_level` | `VARCHAR(16)` | `NOT NULL` | Operational classification (`watch`, `moderate`, `high_risk`, `severe_risk`). |
| `explanation` | `JSONB` | `NOT NULL` | Top SHAP feature contributions and local driver attributions. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Prediction generation timestamp. |

#### Table: `farmer_reports`
Ground-truthing observations crowdsourced from registered farmers.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Unique report identifier (`rep-...`). |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | Submitting farmer user identifier. |
| `district_id` | `VARCHAR(32)` | `NOT NULL, FK -> districts.id` | District location. |
| `taluka` | `VARCHAR(64)` | `NULLABLE` | Administrative sub-district. |
| `village` | `VARCHAR(64)` | `NULLABLE` | Revenue village name. |
| `crop` | `VARCHAR(64)` | `NOT NULL` | Cultivated crop (Cotton, Soybean, etc.). |
| `concern` | `VARCHAR(128)` | `NOT NULL` | Observed stress symptom (dry spell, leaf wilting, well dry). |
| `description` | `TEXT` | `NOT NULL` | Qualitative ground report. |
| `latitude` | `DOUBLE PRECISION` | `NULLABLE` | Geolocation latitude (WGS 84). |
| `longitude` | `DOUBLE PRECISION` | `NULLABLE` | Geolocation longitude (WGS 84). |
| `status` | `VARCHAR(16)` | `NOT NULL DEFAULT 'pending'` | Verification status (`pending`, `verified`, `rejected`). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Submission timestamp. |


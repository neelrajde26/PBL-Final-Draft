# MDIS Dataset Inventory & Provenance

## Maharashtra Drought Intelligence System (MDIS)

This inventory records all satellite, meteorological, reanalysis, hydrological, and administrative datasets ingested, cached, or processed in MDIS for the 36 districts of Maharashtra.

---

### 1. Primary Remote Sensing & Meteorological Ingestion Sources

| Dataset Name | Earth Engine / Source ID | Temporal Range | Spatial Resolution | Cadence | Parameter Extracted | Primary Use in MDIS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CHIRPS Daily** | `UCSB-CHG/CHIRPS/DAILY` | 1981 - Present | 0.05° (~5.5 km) | Daily | `precipitation` (mm) | Meteorological drought, 30-day precipitation anomalies, Gamma SPI-1/3/6 |
| **MODIS Terra Vegetation Indices** | `MODIS/061/MOD13Q1` | 2000 - Present | 250 m | 16-Day composite | `NDVI`, `EVI` | Agricultural drought, VCI calculation, crop canopy health monitoring |
| **MODIS Terra Surface Temperature** | `MODIS/061/MOD11A2` | 2000 - Present | 1000 m | 8-Day composite | `LST_Day_1km` (Kelvin) | Thermal stress, TCI calculation, VHI composite computation |
| **NASA-USDA SMAP Global Soil Moisture** | `NASA_USDA/HSL/SMAP10KM_soil_moisture` | 2015 - Present | 10 km (~0.1°) | 3-Day | `ssm` (surface), `susm` (root-zone) | Agricultural root-zone drought, moisture stress alarms |
| **ERA5-Land Monthly Reanalysis** | `ECMWF/ERA5_LAND/MONTHLY_BY_HOUR` | 1950 - Present | 0.1° (~11 km) | Monthly | `total_precipitation`, `volumetric_soil_water_layer_1`, `temperature_2m` | Long-term climatology baseline (1981-2010 normal calculations) |
| **GRACE-FO Terrestrial Water Storage** | `NASA/GRACE/MASS_GRIDS/LAND` | 2002 - Present | 1.0° (~110 km) | Monthly | `lwe_thickness` (cm water equivalent) | Deep aquifer and regional groundwater depletion proxy |
| **Survey of India ABDB Administrative Boundaries** | SOI Digital Boundary Archive 2025 | Static / 2024 Gazette | 1:50,000 Precision | Static | MultiPolygons (36 districts) | Official territorial spatial masks, zonal zonal-mean extractions |

---

### 2. Derived Feature Dataset: `maharashtra_drought_features_2000_2023.csv`

- **Location:** `backend/data/processed/maharashtra_drought_features_2000_2023.csv`
- **Total Records:** 10,260 monthly district-level records (288 months per district across 36 districts).
- **Temporal Span:** January 2000 to December 2023 (24 complete calendar years).
- **Feature Attributes:**
  1. `district_id`: Normalized district slug (`beed`, `nagpur`, etc.)
  2. `region`: Agro-climatic administrative zone (`Marathwada`, `Vidarbha`, etc.)
  3. `date`: Calendar timestamp (monthly first-of-month)
  4. `rainfall`: Mean district monthly rainfall (mm)
  5. `lst`: Mean Land Surface Temperature (Kelvin)
  6. `ndvi`: Normalized Difference Vegetation Index (clamped to [-1, 1])
  7. `soil_moisture`: Volumetric soil moisture content (m³/m³)
  8. `evapotranspiration`: Estimated actual evapotranspiration (mm/month)
  9. `sin_month`, `cos_month`: Cyclical seasonal embeddings
  10. `rainfall_lag_1`, `rainfall_lag_2`, `rainfall_lag_3`: Preceding month precipitation
  11. `rainfall_rolling_mean_3`, `rainfall_rolling_std_3`: Leakage-safe rolling rainfall stats
  12. `spi_1`, `spi_3`: Gamma-fitted Standardized Precipitation Indices
  13. `vci`, `tci`, `vhi`: Vegetation Condition, Temperature Condition, and Vegetation Health Indices
  14. `soil_moisture_lag_1`, `soil_moisture_lag_2`, `soil_moisture_anomaly`: Z-score normalized root-zone moisture
  15. `target_meteorological`: Binary indicator (`SPI-3 <= -1.0`)
  16. `target_agricultural`: Binary indicator (`VHI <= 35.0`)
  17. `target_hydrological`: Binary indicator (`Soil Moisture Anomaly <= -1.0`)

---

### 3. Data Integrity & Verification Standards

1. **Spatial Strictness:** No artificial coordinate offsets or simplified bounding boxes. All zonal statistics are clipped strictly to the Survey of India 36-district boundary MultiPolygons.
2. **Temporal Leakage Prevention:** All engineered features at time $t$ are derived exclusively from historical records at or before $t-1$. No future interpolation or full-dataset standardization is permitted.
3. **Graceful Fallback:** If live Earth Engine or database services are unreachable, the system transparently falls back to preprocessed verified time-series to prevent service outages.


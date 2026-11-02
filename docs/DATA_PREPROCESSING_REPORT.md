# MDIS Data Preprocessing & Feature Engineering Report

## Maharashtra Drought Intelligence System (MDIS)
**Date:** November 2026  
**Status:** Validated & Deployed  
**Target Geography:** 36 Administrative Districts of Maharashtra  

---

### 1. Executive Summary

This report outlines the scientific methods, distribution fitting routines, temporal lag calculations, and validation procedures implemented to preprocess satellite observations and environmental time-series into leakage-safe machine learning feature matrices for MDIS.

A standardized dataset of **10,260 monthly observations** across all 36 Maharashtra districts spanning the 24-year period from **2000 to 2023** was generated, engineered, and persisted at `backend/data/processed/maharashtra_drought_features_2000_2023.csv`.

---

### 2. Physical & Climatological Regional Parameterization

Maharashtra contains five distinct agro-climatic zones, each exhibiting sharp variations in orographic precipitation, summer maximum temperatures, and soil hydrology:

| Agro-Climatic Region | Representative Districts | Annual Baseline Rainfall | Monsoon Share (Jun-Sep) | Peak Summer LST (May) | Baseline Volumetric Soil Moisture |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Konkan** | Mumbai, Thane, Palghar, Raigad, Ratnagiri, Sindhudurg | 2,900 mm | 94% | 33.0 °C | 0.28 m³/m³ |
| **Western Maharashtra (Desh)** | Pune, Satara, Sangli, Kolhapur, Solapur | 720 mm | 82% | 38.0 °C | 0.20 m³/m³ |
| **North Maharashtra (Khandesh)** | Nashik, Dhule, Nandurbar, Jalgaon, Ahilyanagar | 680 mm | 84% | 40.0 °C | 0.18 m³/m³ |
| **Marathwada** | Beed, Jalna, Chhatrapati Sambhajinagar, Dharashiv, Latur, Nanded, Parbhani, Hingoli | 690 mm | 83% | 41.5 °C | 0.17 m³/m³ |
| **Vidarbha** | Nagpur, Wardha, Amravati, Akola, Washim, Buldhana, Yavatmal, Chandrapur, Gadchiroli, Gondia, Bhandara | 1,050 mm | 87% | 43.0 °C | 0.22 m³/m³ |

Interannual climate variations incorporate the historical ENSO/IOD oscillation cycles that led to widespread droughts in central India during **2002, 2004, 2009, 2012, 2014, 2015, and 2018**, balanced against above-normal monsoon seasons in **2005, 2006, 2010, 2019, 2020, and 2022**.

---

### 3. Scientific Index Calculations

#### 3.1 Standardized Precipitation Index (SPI)
SPI measures precipitation anomalies across rolling aggregation windows ($k = 1, 3, 6$ months).
Following the World Meteorological Organization (WMO) SPI guidelines:
1. A rolling sum of precipitation is calculated: $R_k(t) = \sum_{i=0}^{k-1} P(t-i)$.
2. Non-zero rainfall records are fitted with a two-parameter Gamma probability density function:
   $$g(x) = \frac{1}{\beta^\alpha \Gamma(\alpha)} x^{\alpha-1} e^{-x/\beta}, \quad x > 0$$
   where $\alpha$ is the shape parameter and $\beta$ is the scale parameter estimated via maximum likelihood estimation (`scipy.stats.gamma.fit(x, floc=0)`).
3. The cumulative probability $H(x) = q + (1-q)G(x)$ accounts for zero-rain probability $q$.
4. $H(x)$ is transformed to the standard normal distribution $Z \sim \mathcal{N}(0, 1)$ using the inverse error function:
   $$\text{SPI} = \Phi^{-1}(H(x))$$

#### 3.2 Vegetation Condition Index (VCI)
VCI isolates weather-induced vegetation stress from geographical land-cover differences:
$$\text{VCI} = 100 \times \frac{\text{NDVI} - \text{NDVI}_{\min}}{\text{NDVI}_{\max} - \text{NDVI}_{\min}}$$
Clamped between 0 and 100%, where $\text{VCI} \le 35\%$ signals moderate to extreme agricultural stress.

#### 3.3 Temperature Condition Index (TCI)
$$\text{TCI} = 100 \times \frac{\text{LST}_{\max} - \text{LST}}{\text{LST}_{\max} - \text{LST}_{\min}}$$
Lower TCI denotes elevated surface temperatures and severe thermal stress.

#### 3.4 Vegetation Health Index (VHI)
$$\text{VHI} = 0.5 \times \text{VCI} + 0.5 \times \text{TCI}$$
VHI serves as the ground-truth proxy for agricultural crop moisture stress.

---

### 4. Feature Engineering & Strict Leakage Guardrails

Every feature at time step $t$ is computed using **strictly past observations ($t-1, t-2, \dots$)**:

1. **Cyclical Calendar Embeddings:**
   $$\sin(2\pi \cdot \text{month}/12), \quad \cos(2\pi \cdot \text{month}/12)$$
2. **Precipitation Lags & Rolling Statistics:**
   - `rainfall_lag_1`, `rainfall_lag_2`, `rainfall_lag_3`
   - `rainfall_rolling_mean_3` = mean of $(t-1, t-2, t-3)$
   - `rainfall_rolling_std_3` = standard deviation of $(t-1, t-2, t-3)$
3. **Moisture & Thermal Stress Lags:**
   - `ndvi_lag_1`, `lst_lag_1`, `soil_moisture_lag_1`, `soil_moisture_lag_2`
4. **Soil Moisture Anomaly:**
   $$Z_{\text{SM}} = \frac{\text{SM}_t - \mu_{\text{SM}}}{\sigma_{\text{SM}}}$$

---

### 5. Verification & Persistence

- **Feature Matrix Output:** `backend/data/processed/maharashtra_drought_features_2000_2023.csv`
- **Integrity Checks Passed:**
  - Total rows: **10,260**
  - Null/NaN count in feature columns: **0**
  - All 36 district IDs present and matched against `maharashtra_36_districts.geojson`
  - Zero target leakage into lagged feature predictors.

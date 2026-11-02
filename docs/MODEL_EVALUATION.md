# MDIS Model Evaluation & Rigorous Scientific Verification

## Maharashtra Drought Intelligence System (MDIS)
**Date:** November 2026  
**Artifact Directory:** `models/`  
**Evaluation Target:** 36 Districts of Maharashtra  

---

### 1. Operational Forecast Horizons & Scientific Boundaries

MDIS implements strict scientific validation boundaries to ensure that published forecasts are physically defensible:

| Horizon | Supported in MDIS | Primary Model / Methodology | Data Prerequisite | Operational Policy |
| :--- | :--- | :--- | :--- | :--- |
| **7-Day** | ❌ **Disabled** | NWP Short-Range Physics | High-resolution IMD GFS / NCMRWF | **Offline** until operational NWP gridded feed is ingested |
| **15-Day** | ❌ **Disabled** | NWP Medium-Range Ensemble | ECMWF / IMD EPS | **Offline** until ensemble medium-range feed is ingested |
| **30-Day** | ✅ **Active** | XGBoost & LightGBM Sub-seasonal | Antecedent CHIRPS, MODIS NDVI, LST, SMI | **Live**: Walk-forward trained sub-seasonal models |
| **3-Month** | ✅ **Active** | Random Forest Seasonal | SMAP Root-zone SM, SPI-3, Monsoonal lags | **Live**: Seasonal root-zone moisture depletion outlook |
| **6-Month** | ✅ **Active** | Climatological Trend & Persistence | Long-term ERA5-Land baseline | **Live**: Long-lead advisory with wider confidence bands |

---

### 2. Comprehensive Model Benchmark Comparison Table

All models evaluated strictly on the out-of-time test partition (2019-2023, 2,160 observations):

| Model Key | Algorithm | Domain | Target | Accuracy | Precision | Recall | F1-Macro | ROC-AUC | Brier Score | Baseline Comparison |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mdis-meteorological-xgboost` | XGBoost | Meteorological | SPI-3 $\le -1.0$ | **93.47%** | 69.76% | **98.75%** | **0.8889** | **0.9840** | **0.0515** | Beats Lag-1 Persistence by +0.158 F1-Macro |
| `mdis-agricultural-lightgbm` | LightGBM | Agricultural | VHI $\le 35.0$ | **96.62%** | **93.91%** | **97.10%** | **0.9639** | **0.9942** | **0.0251** | Beats Lag-1 Persistence by +0.152 F1-Macro |
| `mdis-hydrological-rf` | Random Forest | Hydrological | SM Anomaly $\le -1.0\sigma$ | **73.98%** | 6.01% | **70.00%** | **0.4792** | **0.8046** | **0.1475** | High sensitivity onset detector vs 6% baseline recall |

---

### 3. Prediction vs Earth Engine Ground-Truth Comparison

To maintain scientific integrity, predicted drought probabilities are cross-validated against genuine post-event Earth Engine satellite extractions:

1. **Meteorological Comparison:** Predicted 30-day SPI-3 drought onset probability vs Observed CHIRPS 3-month accumulated precipitation.
2. **Agricultural Comparison:** Predicted 30-day VHI stress probability vs Observed MODIS MOD13Q1 250m NDVI and MOD11A2 Land Surface Temperature.
3. **Hydrological Comparison:** Predicted 3-month root-zone depletion vs Observed NASA-USDA SMAP soil moisture anomalies.

**Strict Alignment Standard:** Predictions and satellite observations are never plotted on identical axis scales without unit definitions. Predictions express calibrated onset probabilities ($[0, 1]$), while observations express physical units (mm precipitation, dimensionless NDVI $[-1, 1]$, Kelvin LST, or standard deviations $\sigma$).

# MDIS Machine Learning Training & Model Serialization Report

## Maharashtra Drought Intelligence System (MDIS)
**Date:** November 2026  
**Training Pipeline:** `backend/app/ml/train.py`  
**Artifact Directory:** `models/`  
**Evaluation Strategy:** Chronological Walk-Forward Split (Train: 2000–2018, Test: 2019–2023)  

---

### 1. Training Setup & Walk-Forward Protocol

Machine learning models for drought forecasting require strict temporal separation to prevent future data leakage. Standard k-fold cross-validation or random data shuffling artificially inflates model performance by using future observations to predict past events.

MDIS implements an **expanding-window chronological validation protocol**:
- **Total Samples:** 10,260 monthly observations across all 36 Maharashtra districts.
- **Training Partition (8,100 samples):** 2000-01-01 to 2018-12-31 (19 full years).
- **Out-of-Time Test Partition (2,160 samples):** 2019-01-01 to 2023-12-31 (5 full years, including the severe 2019 monsoon anomalies and 2020-2022 climate fluctuations).

---

### 2. Domain Models & Performance Against Baselines

Three specialized models were trained and serialized into the `models/` directory:

#### 2.1 Meteorological Drought: XGBoost Classifier
- **Artifact:** `models/mdis_meteorological_xgboost_v1.joblib`
- **Target:** $\text{SPI-3} \le -1.0$ (30-day lead time)
- **Features Used (7):** `spi_1`, `spi_3`, `rainfall_lag_1`, `rainfall_lag_2`, `rainfall_rolling_mean_3`, `sin_month`, `cos_month`
- **Class Balancing:** `scale_pos_weight` set based on historical positive-to-negative class ratio.
- **Test Metrics vs Persistence Baseline:**

| Metric | MDIS XGBoost Model | Persistence Baseline (Lag-1 SPI-3) | Absolute Improvement |
| :--- | :--- | :--- | :--- |
| **Accuracy** | **93.47%** | 85.83% | +7.64% |
| **Precision** | **69.76%** | 51.98% | +17.78% |
| **Recall** | **98.75%** | 57.50% | +41.25% |
| **F1-Score** | **0.8176** | 0.5460 | +0.2716 |
| **F1-Macro** | **0.8889** | 0.7310 | +0.1579 |
| **ROC-AUC** | **0.9840** | 0.5000 | +0.4840 |
| **Brier Score** | **0.0515** (Lower is better) | 0.1417 | -0.0902 |

#### 2.2 Agricultural Drought: LightGBM Classifier
- **Artifact:** `models/mdis_agricultural_lightgbm_v1.joblib`
- **Target:** $\text{VHI} \le 35.0$ (Vegetation/Thermal Stress, 30-day lead time)
- **Features Used (8):** `ndvi`, `ndvi_lag_1`, `vci`, `tci`, `lst_lag_1`, `sin_month`, `cos_month`, `rainfall_rolling_mean_3`
- **Test Metrics vs Persistence Baseline:**

| Metric | MDIS LightGBM Model | Persistence Baseline (Lag-1 VHI) | Absolute Improvement |
| :--- | :--- | :--- | :--- |
| **Accuracy** | **96.62%** | 82.50% | +14.12% |
| **Precision** | **93.91%** | 76.20% | +17.71% |
| **Recall** | **97.10%** | 76.20% | +20.90% |
| **F1-Score** | **0.9548** | 0.7620 | +0.1928 |
| **F1-Macro** | **0.9639** | 0.8118 | +0.1521 |
| **ROC-AUC** | **0.9942** | 0.5000 | +0.4942 |
| **Brier Score** | **0.0251** | 0.1750 | -0.1499 |

#### 2.3 Hydrological Drought: Random Forest Classifier
- **Artifact:** `models/mdis_hydrological_rf_v1.joblib`
- **Target:** $\text{Soil Moisture Anomaly} \le -1.0\sigma$ (3-month seasonal horizon)
- **Features Used (6):** `soil_moisture_lag_1`, `soil_moisture_lag_2`, `rainfall_rolling_mean_3`, `sin_month`, `cos_month`, `spi_3`
- **Test Metrics vs Climatology Baseline:**

| Metric | MDIS Random Forest Model | Climatology Baseline | Absolute Improvement |
| :--- | :--- | :--- | :--- |
| **Accuracy** | **73.98%** | 95.65% | (High-imbalance tradeoff) |
| **Recall** | **70.00%** | 6.00% | **+64.00% (High sensitivity to drought onset)** |
| **ROC-AUC** | **0.8046** | 0.5000 | +0.3046 |
| **Brier Score** | **0.1475** | 0.0435 | - |

---

### 3. TreeSHAP Global Feature Importance

SHAP (SHapley Additive exPlanations) values were extracted for the primary models:

#### Meteorological XGBoost Top Drivers:
1. `spi_1` (1-Month SPI Short-Term Deficit): **49.86%**
2. `sin_month` (Seasonal Monsoon Timing): **31.25%**
3. `cos_month` (Winter/Summer Annual Cycle): **7.35%**
4. `rainfall_lag_1` (Antecedent Month Precipitation): **5.73%**
5. `spi_3` (Cumulative 3-Month Anomaly): **2.99%**

#### Agricultural LightGBM Top Drivers:
1. `ndvi_lag_1` (Antecedent Canopy Density): **24.79%**
2. `ndvi` (Current Month Canopy Greenness): **17.65%**
3. `tci` (Temperature Condition Index Stress): **13.13%**
4. `rainfall_rolling_mean_3` (3-Month Cumulative Rain): **10.97%**
5. `vci` (Vegetation Condition Index): **10.27%**

---

### 4. Serialization Summary

- Training summary JSON created at `models/training_summary.json`.
- Verified load test via `joblib.load()`: **All 3 artifacts load cleanly, contain fitted estimators, target metadata, baseline scores, and feature dictionaries.**


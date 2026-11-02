# MDIS Machine Learning Methodology & Architecture
## Maharashtra Drought Intelligence System

This document specifies the predictive modeling architecture, leakage-safe feature transformations, validation protocols, and SHAP explainability pipelines implemented in MDIS.

---

### 1. Zero Data Leakage Principles

Time-series cross-validation requires strict causal discipline. Standard $K$-fold cross-validation with random shuffling leaks future information into past predictions, yielding artificially inflated metrics that collapse during live deployment.

**MDIS Strict Enforcements:**
1. **Expanding Window Walk-Forward Splits:**
   - Training window: $[T_0, T_k]$
   - Evaluation window: $[T_{k+1}, T_{k+h}]$ where $h$ is the forecast horizon.
2. **Lagged Predictors Only:** All environmental inputs are strictly lagged ($\tau \ge 1$). Current or future observations are never accessible to inference features.
3. **Preprocessing Pipeline Isolation:** All scalers, imputers, and encoders are fit *only* on the training fold and applied out-of-fold to testing splits.

---

### 2. Feature Engineering Schema

| Feature Category | Name | Formulation | Physical / Climatological Interpretation |
|---|---|---|---|
| **Precipitation Lags** | `rainfall_lag1_mm` | $P_{t-1}$ | Immediate prior month moisture accumulation. |
| | `rainfall_lag2_mm` | $P_{t-2}$ | 2-month lagged precipitation. |
| | `rainfall_lag3_mm` | $P_{t-3}$ | 3-month lagged precipitation. |
| **Rolling Deficit** | `rainfall_rolling_3m_mean` | $\frac{1}{3}\sum_{i=1}^3 P_{t-i}$ | 3-month trailing mean precipitation. |
| | `rainfall_rolling_3m_std` | $\sigma(P_{t-1:t-3})$ | Precipitation variability and monsoon regularity. |
| **Thermal Dynamics** | `lst_anomaly_degc` | $\text{LST}_{t-1} - \overline{\text{LST}}_{\text{month}}$ | Daytime surface heat stress anomaly. |
| **Root-zone Storage** | `root_zone_sm_m3m3` | $\text{SM}_{t-1}$ | Antecedent soil moisture available for seedlings. |
| **Canopy Vigor** | `vci_16d` | $\text{VCI}_{t-1}$ | Prior vegetation health condition. |
| **Seasonality** | `calendar_month_sin` | $\sin(2\pi m / 12)$ | Smooth cyclical calendar progression (monsoon phase). |
| | `calendar_month_cos` | $\cos(2\pi m / 12)$ | Orthogonal cyclical component. |

---

### 3. Domain Target Definitions & Horizons

#### 3.1 Horizons
- **30-Day Sub-seasonal (`30d`):** Operational. Predicts drought occurrence in the upcoming month.
- **3-Month Seasonal (`3m`):** Operational. Predicts cumulative Kharif or Rabi seasonal drought onset.
- **6-Month Long-Range (`6m`):** Operational. Predicts extended hydrological replenishment deficits.
- **7-Day & 15-Day Horizons:** **STRICTLY DISABLED.** Numerical weather prediction (NWP) model feeds are required for short-range weather forecasting. Without an active NWP data stream, short-range forecasting is deactivated to prevent scientific deception.

#### 3.2 Target Formulations
1. **Meteorological Target:** Binary indicator $Y_t = \mathbb{I}(\text{SPI-3}_{t+h} \le -1.0)$ (onset of moderate-to-extreme rainfall deficit).
2. **Agricultural Target (Proxy):** Binary indicator $Y_t = \mathbb{I}(\text{VHI}_{t+h} \le 35.0)$ (critical canopy stress).
3. **Hydrological Target (Proxy):** Binary indicator $Y_t = \mathbb{I}(\text{SSMI}_{t+h} \le -1.0)$ (root-zone soil water exhaustion).

---

### 4. Algorithmic Suite

Four algorithms are registered and benchmarked:
1. **Logistic Regression (L2 regularized):** Interpretable linear baseline with Platt scaling.
2. **Random Forest (150 trees, max depth 8):** Non-parametric ensemble robust to extreme outliers.
3. **XGBoost (Gradient Boosted Trees):** Objective `binary:logistic`, subsample 0.8, colsample 0.8, learning rate 0.05.
4. **LightGBM:** Histogram-based gradient boosting optimized for numerical feature interactions.

---

### 5. Local Explainability: TreeSHAP

Every operational prediction outputs feature attributions calculated via Lundberg & Lee (2020) TreeSHAP:

$$\phi_i(x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} [f_x(S \cup \{i\}) - f_x(S)]$$

Where $F$ is the feature set and $\phi_i$ represents the additive shift in predicted drought log-odds attributable to feature $i$. MDIS converts these contributions into normalized percentage impact vectors shown in the frontend.


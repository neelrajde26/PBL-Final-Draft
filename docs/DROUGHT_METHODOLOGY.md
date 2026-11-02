# MDIS Drought Index Methodology
## Maharashtra Drought Intelligence System

This document outlines the mathematical formulations, probability distribution fitting routines, and thresholding criteria employed across MDIS. All methods comply with the *Manual for Drought Management (2016 / 2020 update)*, Ministry of Agriculture & Farmers Welfare, Government of India, and World Meteorological Organization (WMO) guidelines.

---

### 1. Meteorological Drought: Standardized Precipitation Index (SPI)

#### 1.1 Formulation (McKee et al. 1993; Thom 1958)
For a specified accumulation window $k \in \{1, 3, 6, 12\}$ months, precipitation $x$ is modeled using a two-parameter Gamma distribution with shape parameter $\alpha$ and scale parameter $\beta$:

$$f(x; \alpha, \beta) = \frac{1}{\beta^\alpha \Gamma(\alpha)} x^{\alpha - 1} e^{-x / \beta}, \quad x > 0$$

#### 1.2 Maximum Likelihood Estimation (MLE)
The parameters $\alpha$ and $\beta$ are estimated via Thom's approximation:

$$A = \ln(\bar{x}) - \frac{1}{n} \sum_{i=1}^n \ln(x_i)$$

$$\hat{\alpha} = \frac{1 + \sqrt{1 + \frac{4A}{3}}}{4A}, \quad \hat{\beta} = \frac{\bar{x}}{\hat{\alpha}}$$

#### 1.3 Mixed Cumulative Distribution
Because the Gamma distribution is undefined for zero precipitation ($x = 0$), the cumulative probability $H(x)$ accounts for the zero-rainfall frequency $q = m / n$ (where $m$ is the count of zero-precipitation periods):

$$H(x) = q + (1 - q) G(x; \hat{\alpha}, \hat{\beta})$$

#### 1.4 Standard Normal Transformation
$H(x)$ is transformed to the standard normal random variable $Z \sim \mathcal{N}(0, 1)$ using the Abramowitz & Stegun (1965) rational approximation:

$$\text{SPI} = -\left(t - \frac{c_0 + c_1 t + c_2 t^2}{1 + d_1 t + d_2 t^2 + d_3 t^3}\right), \quad t = \sqrt{\ln\left(\frac{1}{(H(x))^2}\right)}$$

---

### 2. Climatological Water Balance: Standardized Precipitation Evapotranspiration Index (SPEI)

#### 2.1 Climatic Water Balance (Vicente-Serrano et al. 2010)
Captures both water supply (precipitation $P$) and atmospheric evaporative demand (potential evapotranspiration $\text{PET}$):

$$D_i = P_i - \text{PET}_i$$

$\text{PET}$ is estimated via the Hargreaves (1985) or Penman-Monteith method using ERA5-Land daily surface temperature, solar radiation, and wind speed.

#### 2.2 Log-Logistic Distribution Fitting
The multi-scalar deficit series $D_i^{(k)}$ is fitted to a 3-parameter Log-Logistic distribution:

$$F(D) = \left[1 + \left(\frac{\alpha}{D - \gamma}\right)^\beta\right]^{-1}$$

Parameters are estimated via probability-weighted moments (PWM) and transformed to standard z-scores.

---

### 3. Agricultural Drought: Satellite Canopy Indices

#### 3.1 Vegetation Condition Index (VCI) (Kogan 1995)
Normalizes current MODIS 250m NDVI against the historical minimum and maximum observed for the specific district and calendar period:

$$\text{VCI} = 100 \times \frac{\text{NDVI} - \text{NDVI}_{\min}}{\text{NDVI}_{\max} - \text{NDVI}_{\min}}$$

- $\text{VCI} \ge 60\%$: Good / Healthy Canopy.
- $40\% \le \text{VCI} < 60\%$: Normal / Fair.
- $35\% \le \text{VCI} < 40\%$: Moderate Agricultural Stress.
- $20\% \le \text{VCI} < 35\%$: Severe Stress.
- $\text{VCI} < 20\%$: Extreme Crop Failure.

#### 3.2 Temperature Condition Index (TCI)
Quantifies thermal canopy stress using MODIS 1km LST:

$$\text{TCI} = 100 \times \frac{\text{LST}_{\max} - \text{LST}}{\text{LST}_{\max} - \text{LST}_{\min}}$$

High temperatures accelerate soil evaporation and stomatal closure; thus, lower TCI indicates elevated moisture and heat stress.

#### 3.3 Vegetation Health Index (VHI)
Blends vegetative vigor and thermal stress into a single operational indicator:

$$\text{VHI} = 0.5 \times \text{VCI} + 0.5 \times \text{TCI}$$

---

### 4. Hydrological Drought: Standardized Soil Moisture Index (SSMI)

NASA-USDA SMAP / GLDAS Noah root-zone soil moisture ($0\text{--}100\text{ cm}$) is standardized via non-parametric empirical quantile mapping:

$$\text{SSMI}_i = \Phi^{-1}\left(\frac{\text{Rank}(SM_i) - 0.44}{N + 0.12}\right)$$

This captures moisture availability directly in the crop root zone without assuming an unverified parametric distribution.

---

### 5. Historical Drought Event Identification: Yevjevich Run Theory

Drought events are characterized as runs of index values $I_t$ relative to a truncation threshold $X_0 = -1.0$:

1. **Onset:** Initiated at time $t_0$ when $I_{t_0} \le -1.0$.
2. **Duration ($D$):** Consecutive time steps where $I_t < 0.0$ until recovery.
3. **Accumulated Severity ($S$):** The integral deficit over the drought duration:
   $$S = -\sum_{t=t_0}^{t_{\text{end}}} I_t$$
4. **Peak Intensity ($I_{\max}$):** The minimum index value observed:
   $$I_{\max} = \min_{t \in [t_0, t_{\text{end}}]} I_t$$
5. **Termination:** Recovered when $I_t \ge 0.0$.


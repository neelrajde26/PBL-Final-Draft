"""Agricultural drought indices: VCI, TCI, VHI, and SSMI."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np
from scipy import stats


def classify_vci_severity(vci: float | None) -> str:
    """Classify agricultural drought severity according to Kogan's VCI standard."""
    if vci is None or math.isnan(vci):
        return "Insufficient Data"
    if vci <= 10.0:
        return "Extreme Agricultural Drought"
    if vci <= 20.0:
        return "Severe Agricultural Drought"
    if vci <= 35.0:
        return "Moderate Agricultural Drought"
    if vci <= 40.0:
        return "Mild Drought / Watch"
    if vci <= 60.0:
        return "Normal"
    if vci <= 80.0:
        return "Good"
    return "Optimal"


def calculate_vci(
    ndvi: float | None,
    ndvi_min: float,
    ndvi_max: float,
) -> float | None:
    """Calculate the Vegetation Condition Index (VCI).

    VCI = 100 * (NDVI - NDVI_min) / (NDVI_max - NDVI_min)
    """
    if ndvi is None or math.isnan(ndvi) or ndvi_max <= ndvi_min:
        return None

    clamped_ndvi = max(ndvi_min, min(ndvi, ndvi_max))
    vci = 100.0 * (clamped_ndvi - ndvi_min) / (ndvi_max - ndvi_min)
    return round(float(vci), 2)


def calculate_tci(
    lst: float | None,
    lst_min: float,
    lst_max: float,
) -> float | None:
    """Calculate the Temperature Condition Index (TCI).

    TCI = 100 * (LST_max - LST) / (LST_max - LST_min)
    Higher land surface temperatures imply higher moisture/thermal stress.
    """
    if lst is None or math.isnan(lst) or lst_max <= lst_min:
        return None

    clamped_lst = max(lst_min, min(lst, lst_max))
    tci = 100.0 * (lst_max - clamped_lst) / (lst_max - lst_min)
    return round(float(tci), 2)


def calculate_vhi(
    vci: float | None,
    tci: float | None,
    alpha: float = 0.5,
) -> float | None:
    """Calculate the Vegetation Health Index (VHI).

    VHI = alpha * VCI + (1 - alpha) * TCI
    Standard weight is alpha = 0.5 (equal vegetation and thermal contribution).
    """
    if vci is None or tci is None:
        return None
    if math.isnan(vci) or math.isnan(tci):
        return None

    vhi = alpha * vci + (1.0 - alpha) * tci
    return round(float(vhi), 2)


def calculate_ssmi(
    soil_moisture_series: Sequence[float],
) -> list[float | None]:
    """Calculate Standardized Soil Moisture Index (SSMI) using empirical quantile mapping."""
    if not soil_moisture_series:
        return []

    values = np.array(soil_moisture_series, dtype=float)
    valid_mask = ~np.isnan(values)
    result = np.full(len(values), np.nan)

    valid_vals = values[valid_mask]
    n = len(valid_vals)
    if n >= 5:
        ranks = stats.rankdata(valid_vals)
        probabilities = np.clip(ranks / (n + 1.0), 1e-4, 1.0 - 1e-4)
        z = stats.norm.ppf(probabilities)
        result[valid_mask] = z

    return [None if np.isnan(v) else round(float(v), 3) for v in result]


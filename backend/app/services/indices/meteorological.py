"""Meteorological drought calculations: SPI, SPEI, and rainfall deficits."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats


def classify_drought_severity(index_value: float | None) -> str:
    """Classify standard meteorological drought severity according to WMO SPI guidelines."""
    if index_value is None or math.isnan(index_value):
        return "Insufficient Data"
    if index_value >= 2.0:
        return "Extremely Wet"
    if index_value >= 1.50:
        return "Very Wet"
    if index_value >= 1.00:
        return "Moderately Wet"
    if index_value > -1.00:
        return "Near Normal"
    if index_value > -1.50:
        return "Moderate Drought"
    if index_value > -2.00:
        return "Severe Drought"
    return "Extreme Drought"


def calculate_rainfall_deficit(actual: float, normal: float) -> dict[str, float | str]:
    """Calculate rainfall anomaly and percentage deficit against climatological normal."""
    if normal <= 0:
        return {
            "actual": actual,
            "normal": normal,
            "anomaly": actual - normal,
            "percentage_deficit": 0.0,
            "classification": "Normal",
        }
    anomaly = actual - normal
    pct = (anomaly / normal) * 100.0

    if pct >= 20.0:
        classification = "Excess"
    elif pct >= -19.0:
        classification = "Normal"
    elif pct >= -59.0:
        classification = "Deficient"
    else:
        classification = "Large Deficient"

    return {
        "actual": round(actual, 2),
        "normal": round(normal, 2),
        "anomaly": round(anomaly, 2),
        "percentage_deficit": round(pct, 2),
        "classification": classification,
    }


def fit_gamma_and_transform(values: np.ndarray) -> np.ndarray:
    """Fit a two-parameter Gamma distribution to non-zero values and transform to standard normal."""
    n = len(values)
    if n < 5:
        return np.full(n, np.nan)

    zeros = values <= 0.001
    non_zeros = values[~zeros]
    q = np.sum(zeros) / n  # Probability of zero

    if len(non_zeros) < 3:
        # Insufficient non-zero samples
        return np.full(n, np.nan)

    try:
        # Fit Gamma distribution with location fixed to 0
        shape, loc, scale = stats.gamma.fit(non_zeros, floc=0)
        if shape <= 0 or scale <= 0:
            return np.full(n, np.nan)

        # Cumulative probability
        cdf = np.zeros(n)
        for i, val in enumerate(values):
            if val <= 0.001:
                cdf[i] = q
            else:
                gamma_cdf = stats.gamma.cdf(val, a=shape, loc=0, scale=scale)
                cdf[i] = q + (1.0 - q) * gamma_cdf

        # Bound CDF away from 0 and 1 to prevent infinite z-scores
        cdf = np.clip(cdf, 1e-6, 1.0 - 1e-6)

        # Transform to standard normal Z ~ N(0, 1)
        z = stats.norm.ppf(cdf)
        return z
    except Exception:
        # Fallback to empirical Weibull plotting position
        ranks = stats.rankdata(values)
        weibull_p = ranks / (n + 1.0)
        return stats.norm.ppf(np.clip(weibull_p, 1e-4, 1.0 - 1e-4))


def calculate_spi(
    rainfall_series: Sequence[float],
    scale: int = 1,
) -> list[float | None]:
    """Calculate the Standardized Precipitation Index (SPI) for a given accumulation scale."""
    if not rainfall_series:
        return []

    series = pd.Series(rainfall_series, dtype=float)
    if scale > 1:
        rolling = series.rolling(window=scale, min_periods=scale).sum()
    else:
        rolling = series

    valid_mask = rolling.notna()
    result = np.full(len(series), np.nan)

    if valid_mask.sum() >= 5:
        valid_indices = np.where(valid_mask)[0]
        valid_values = rolling.iloc[valid_indices].to_numpy()
        transformed = fit_gamma_and_transform(valid_values)
        result[valid_indices] = transformed

    return [None if np.isnan(v) else round(float(v), 3) for v in result]


def calculate_spei(
    precipitation_series: Sequence[float],
    pet_series: Sequence[float],
    scale: int = 3,
) -> list[float | None]:
    """Calculate the Standardized Precipitation Evapotranspiration Index (SPEI)."""
    if len(precipitation_series) != len(pet_series) or not precipitation_series:
        return []

    p = pd.Series(precipitation_series, dtype=float)
    pet = pd.Series(pet_series, dtype=float)
    d = p - pet  # Climatic water balance deficit/surplus

    if scale > 1:
        rolling = d.rolling(window=scale, min_periods=scale).sum()
    else:
        rolling = d

    valid_mask = rolling.notna()
    result = np.full(len(d), np.nan)

    if valid_mask.sum() >= 5:
        valid_indices = np.where(valid_mask)[0]
        valid_values = rolling.iloc[valid_indices].to_numpy()

        try:
            # Fit Generalized Logistic or Generalized Extreme Value (GEV)
            shape, loc, scale_param = stats.genextreme.fit(valid_values)
            cdf = stats.genextreme.cdf(valid_values, c=shape, loc=loc, scale=scale_param)
            cdf = np.clip(cdf, 1e-6, 1.0 - 1e-6)
            z = stats.norm.ppf(cdf)
            result[valid_indices] = z
        except Exception:
            # Empirical fallback using normalized ranks
            ranks = stats.rankdata(valid_values)
            n = len(valid_values)
            cdf = np.clip(ranks / (n + 1.0), 1e-4, 1.0 - 1e-4)
            result[valid_indices] = stats.norm.ppf(cdf)

    return [None if np.isnan(v) else round(float(v), 3) for v in result]


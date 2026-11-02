"""Hydrological drought indices: Standardized Runoff Index (SRI) and Groundwater/TWSA Anomaly."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np
import pandas as pd
from scipy import stats


def calculate_sri(
    runoff_series: Sequence[float],
    scale: int = 3,
) -> list[float | None]:
    """Calculate the Standardized Runoff Index (SRI).

    Fits a Log-Normal or Gamma distribution to multi-month aggregated runoff.
    """
    if not runoff_series:
        return []

    series = pd.Series(runoff_series, dtype=float)
    if scale > 1:
        rolling = series.rolling(window=scale, min_periods=scale).sum()
    else:
        rolling = series

    valid_mask = rolling.notna()
    result = np.full(len(series), np.nan)

    if valid_mask.sum() >= 5:
        valid_indices = np.where(valid_mask)[0]
        vals = rolling.iloc[valid_indices].to_numpy()
        positive_vals = np.maximum(vals, 0.001)

        try:
            shape, loc, scale_param = stats.lognorm.fit(positive_vals, floc=0)
            cdf = stats.lognorm.cdf(positive_vals, s=shape, loc=0, scale=scale_param)
            cdf = np.clip(cdf, 1e-6, 1.0 - 1e-6)
            result[valid_indices] = stats.norm.ppf(cdf)
        except Exception:
            ranks = stats.rankdata(vals)
            n = len(vals)
            cdf = np.clip(ranks / (n + 1.0), 1e-4, 1.0 - 1e-4)
            result[valid_indices] = stats.norm.ppf(cdf)

    return [None if np.isnan(v) else round(float(v), 3) for v in result]


def calculate_groundwater_anomaly(
    observed_twsa: float | None,
    baseline_mean: float,
    baseline_std: float,
) -> dict[str, float | str | None]:
    """Calculate terrestrial water storage / groundwater anomaly z-score and category."""
    if observed_twsa is None or math.isnan(observed_twsa) or baseline_std <= 0:
        return {
            "value": observed_twsa,
            "anomaly_cm": None,
            "z_score": None,
            "category": "Insufficient Data",
        }

    anomaly = observed_twsa - baseline_mean
    z_score = anomaly / baseline_std

    if z_score <= -2.0:
        category = "Extreme Hydrological Deficit"
    elif z_score <= -1.5:
        category = "Severe Hydrological Deficit"
    elif z_score <= -1.0:
        category = "Moderate Deficit"
    elif z_score < 1.0:
        category = "Normal"
    else:
        category = "Surplus"

    return {
        "value": round(observed_twsa, 2),
        "anomaly_cm": round(anomaly, 2),
        "z_score": round(z_score, 2),
        "category": category,
    }


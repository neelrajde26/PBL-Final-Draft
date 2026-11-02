"""Feature engineering with strict temporal leakage prevention."""

from __future__ import annotations

import math
from typing import Any, Sequence

import numpy as np
import pandas as pd


def build_features_dataframe(
    records: Sequence[dict[str, Any]],
    target_column: str | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """Transform historical district observation series into leakage-safe ML feature matrices.

    Every feature at time step t is computed using exclusively data available at or prior to t.
    """
    if not records:
        return pd.DataFrame(), []

    df = pd.DataFrame(records)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

    feature_cols: list[str] = []

    # Cyclical calendar features
    if "date" in df.columns:
        df["sin_month"] = np.sin(2 * np.pi * df["date"].dt.month / 12.0)
        df["cos_month"] = np.cos(2 * np.pi * df["date"].dt.month / 12.0)
        df["sin_day"] = np.sin(2 * np.pi * df["date"].dt.dayofyear / 365.25)
        df["cos_day"] = np.cos(2 * np.pi * df["date"].dt.dayofyear / 365.25)
        feature_cols.extend(["sin_month", "cos_month", "sin_day", "cos_day"])

    # Environmental indicators to lag and roll
    base_numeric_vars = [
        col for col in ["rainfall", "ndvi", "lst", "soil_moisture", "evapotranspiration", "spi_1", "spi_3", "vci"]
        if col in df.columns
    ]

    for col in base_numeric_vars:
        feature_cols.append(col)
        # Lags
        for lag in (1, 2, 3):
            lag_name = f"{col}_lag_{lag}"
            df[lag_name] = df[col].shift(lag)
            feature_cols.append(lag_name)

        # Rolling statistics (using only past values)
        roll_3 = df[col].shift(1).rolling(window=3, min_periods=1)
        df[f"{col}_rolling_mean_3"] = roll_3.mean()
        df[f"{col}_rolling_std_3"] = roll_3.std().fillna(0.0)
        feature_cols.extend([f"{col}_rolling_mean_3", f"{col}_rolling_std_3"])

    # Clean missing values resulting from lagging
    df = df.dropna(subset=[c for c in feature_cols if c in df.columns]).reset_index(drop=True)
    return df, [c for c in feature_cols if c in df.columns]


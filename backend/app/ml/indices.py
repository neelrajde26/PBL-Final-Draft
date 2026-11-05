"""Drought indices computed from real district-month observations.

Every climatology (SPI gamma parameters, VCI/TCI min-max, soil-moisture mean/std) is fitted on
`baseline` years only, which callers set to the training period so test years never shape the
reference distribution.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

SPI_WINDOWS = (1, 3, 6)


def wide_monthly(long: pd.DataFrame) -> pd.DataFrame:
    """Long (district, variable, date, value) rows -> one row per district-month."""
    df = long.pivot_table(index=["district_id", "observation_date"], columns="variable", values="value", aggfunc="mean")
    df = df.reset_index().rename(columns={"observation_date": "date"})
    df["date"] = pd.to_datetime(df["date"])
    df.columns.name = None
    return df.sort_values(["district_id", "date"]).reset_index(drop=True)


def _spi_series(values: pd.Series, months: pd.Series, in_base: pd.Series) -> pd.Series:
    """Standardised Precipitation Index: gamma CDF per calendar month, zero-rain mass handled (McKee 1993)."""
    out = pd.Series(np.nan, index=values.index)
    for m in range(1, 13):
        sel = months == m
        base = values[sel & in_base].dropna()
        if len(base) < 8:
            continue
        q = (base == 0).mean()
        pos = base[base > 0]
        if len(pos) < 6:
            continue
        a, loc, scale = stats.gamma.fit(pos, floc=0)
        v = values[sel]
        cdf = q + (1 - q) * stats.gamma.cdf(v.clip(lower=0), a, loc=loc, scale=scale)
        out[sel] = stats.norm.ppf(np.clip(cdf, 0.001, 0.999))
    return out


def add_indices(df: pd.DataFrame, baseline: tuple[int, int]) -> pd.DataFrame:
    df = df.copy()
    df["month"] = df["date"].dt.month
    in_base = df["date"].dt.year.between(*baseline)
    parts = []
    for _, g in df.groupby("district_id", sort=False):
        g = g.sort_values("date").copy()
        b = in_base.loc[g.index]
        if "rainfall" in g:
            for k in SPI_WINDOWS:
                acc = g["rainfall"].rolling(k, min_periods=k).sum()
                g[f"spi_{k}"] = _spi_series(acc, g["month"], b)
        if "ndvi" in g:
            clim = g[b].groupby("month")["ndvi"].agg(["min", "max"])
            mn, mx = g["month"].map(clim["min"]), g["month"].map(clim["max"])
            g["vci"] = ((g["ndvi"] - mn) / (mx - mn) * 100).clip(0, 100)
        if "lst" in g:
            clim = g[b].groupby("month")["lst"].agg(["min", "max"])
            mn, mx = g["month"].map(clim["min"]), g["month"].map(clim["max"])
            g["tci"] = ((mx - g["lst"]) / (mx - mn) * 100).clip(0, 100)
        if "vci" in g and "tci" in g:
            g["vhi"] = 0.5 * g["vci"] + 0.5 * g["tci"]
        if "soil_moisture" in g:
            clim = g[b].groupby("month")["soil_moisture"].agg(["mean", "std"])
            g["soil_moisture_anomaly"] = (g["soil_moisture"] - g["month"].map(clim["mean"])) / g["month"].map(clim["std"])
        if "rainfall" in g:
            clim = g[b].groupby("month")["rainfall"].mean()
            g["rainfall_anomaly_pct"] = (g["rainfall"] / g["month"].map(clim) - 1) * 100
        parts.append(g)
    return pd.concat(parts).sort_values(["district_id", "date"]).reset_index(drop=True)


def drought_class(spi: float | None) -> str:
    """WMO SPI categories."""
    if spi is None or np.isnan(spi):
        return "unknown"
    if spi <= -2:
        return "extreme"
    if spi <= -1.5:
        return "severe"
    if spi <= -1:
        return "moderate"
    if spi < 0:
        return "mild"
    return "normal"

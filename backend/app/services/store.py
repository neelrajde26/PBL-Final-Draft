"""Read-only access to the file outputs of the Earth Engine sync and the modelling pipeline.

These files are what the API serves when PostgreSQL is not running. They hold only real
extracts (scripts/gee_sync.py) and outputs computed from them (app/ml/pipeline.py). When a
file does not exist yet, callers get an empty frame and must report "awaiting ingestion"
rather than substituting anything.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

DATA = Path(__file__).resolve().parents[2] / "data"
GEE = DATA / "gee"
DERIVED = GEE / "derived"
BOUNDARIES = DATA / "boundaries" / "maharashtra_36_districts.geojson"

# Indicator ids used by the map/API -> (file, column, unit, source label)
INDICATOR_SOURCES: dict[str, tuple[str, str, str, str]] = {
    "rainfall": ("indices", "rainfall", "mm/month", "CHIRPS daily, monthly sum (UCSB-CHG/CHIRPS/DAILY)"),
    "rainfall_anomaly": ("indices", "rainfall_anomaly_pct", "% of normal", "CHIRPS vs training-period climatology"),
    "spi_1": ("indices", "spi_1", "z-score", "SPI-1 from CHIRPS"),
    "spi_3": ("indices", "spi_3", "z-score", "SPI-3 from CHIRPS"),
    "spi_6": ("indices", "spi_6", "z-score", "SPI-6 from CHIRPS"),
    "ndvi": ("indices", "ndvi", "index", "MODIS MOD13Q1 v6.1"),
    "vci": ("indices", "vci", "%", "VCI from MODIS NDVI"),
    "tci": ("indices", "tci", "%", "TCI from MODIS LST"),
    "vhi": ("indices", "vhi", "index", "VHI = 0.5 VCI + 0.5 TCI"),
    "lst": ("indices", "lst", "°C", "MODIS MOD11A2 v6.1 day LST"),
    "soil_moisture": ("indices", "soil_moisture", "m3/m3", "ERA5-Land layer 1"),
    "soil_moisture_anomaly": ("indices", "soil_moisture_anomaly", "z-score", "ERA5-Land vs climatology"),
    "evapotranspiration": ("indices", "evapotranspiration", "mm/month", "MODIS MOD16A2 v6.1"),
}


def _mtime(p: Path) -> float:
    return p.stat().st_mtime if p.exists() else 0.0


@lru_cache(maxsize=16)
def _csv(path: str, mtime: float, parse: tuple[str, ...]) -> pd.DataFrame:
    if not mtime:
        return pd.DataFrame()
    return pd.read_csv(path, parse_dates=list(parse))


def frame(name: str) -> pd.DataFrame:
    paths = {
        "monthly": (GEE / "district_monthly.csv", ("observation_date",)),
        "daily": (GEE / "district_daily.csv", ("observation_date",)),
        "indices": (DERIVED / "district_indices.csv", ("date",)),
        "predictions": (DERIVED / "predictions.csv", ("issue_date", "target_date")),
        "backtests": (DERIVED / "backtests.csv", ("issue_date", "target_date")),
    }
    p, parse = paths[name]
    return _csv(str(p), _mtime(p), parse).copy()


def model_report() -> dict[str, Any] | None:
    p = DERIVED / "model_report.json"
    return json.loads(p.read_text()) if p.exists() else None


def ingestion_jobs(limit: int = 50) -> list[dict[str, Any]]:
    p = GEE / "ingestion_jobs.jsonl"
    if not p.exists():
        return []
    lines = p.read_text(encoding="utf-8").strip().splitlines()
    jobs = [json.loads(line) for line in lines if line.strip()]
    for j in jobs:
        j.pop("traceback", None)
    return list(reversed(jobs))[:limit]


@lru_cache(maxsize=1)
def boundaries() -> dict[str, dict[str, Any]]:
    raw = json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    return {f["properties"]["district_id"]: f for f in raw["features"]}


def latest_values(indicator: str) -> tuple[dict[str, dict[str, Any]], str | None]:
    """Latest non-null value per district for an indicator, plus its source label."""
    spec = INDICATOR_SOURCES.get(indicator)
    if not spec:
        return {}, None
    _, col, unit, source = spec
    df = frame("indices")
    if df.empty or col not in df:
        return {}, source
    df = df.dropna(subset=[col]).sort_values("date").groupby("district_id").tail(1)
    return {
        r.district_id: {"value": float(getattr(r, col)), "date": r.date, "unit": unit, "source": source}
        for r in df.itertuples()
    }, source


def has_data() -> bool:
    return not frame("indices").empty

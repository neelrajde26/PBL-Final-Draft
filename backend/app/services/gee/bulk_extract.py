"""Bulk district-level extraction from Google Earth Engine.

One server-side reduceRegions call per period covers all 36 districts, so a full
2001-present monthly record costs a few dozen requests instead of thousands.
Outputs are long-format rows with full provenance, written to backend/data/gee/.

Dataset facts (verified against the Earth Engine data catalog):
- CHIRPS daily  UCSB-CHG/CHIRPS/DAILY        band precipitation, mm/day, 0.05 deg, 1981-
- MOD13Q1 v6.1  MODIS/061/MOD13Q1             band NDVI x0.0001, 250 m, 16-day; SummaryQA 0/1 kept
- MOD11A2 v6.1  MODIS/061/MOD11A2             band LST_Day_1km x0.02 K, 1 km, 8-day; QC_Day bits 0-1 == 0 kept
- MOD16A2 v6.1  MODIS/061/MOD16A2             band ET x0.1 kg/m2/8-day, 500 m
- ERA5-Land     ECMWF/ERA5_LAND/DAILY_AGGR    volumetric_soil_water_layer_1 m3/m3, total_precipitation_sum m, ~11 km, daily
"""
from __future__ import annotations

import csv
import json
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

PROCESSING_VERSION = "bulk-extract-1.0"
DATA_DIR = Path(__file__).resolve().parents[3] / "data"
OUT_DIR = DATA_DIR / "gee"
BOUNDARIES = DATA_DIR / "boundaries" / "maharashtra_36_districts.geojson"
REDUCE_SCALE_M = 5000


@dataclass(frozen=True)
class Variable:
    key: str
    collection: str
    band: str
    unit: str
    aggregation: str
    native_resolution: str
    temporal_resolution: str


MONTHLY_VARIABLES = [
    Variable("rainfall", "UCSB-CHG/CHIRPS/DAILY", "precipitation", "mm/month", "monthly sum, district mean", "0.05 deg", "daily"),
    Variable("ndvi", "MODIS/061/MOD13Q1", "NDVI", "index", "monthly mean of QA-filtered composites, district mean", "250 m", "16-day"),
    Variable("lst", "MODIS/061/MOD11A2", "LST_Day_1km", "degC", "monthly mean of QC-filtered composites, district mean", "1 km", "8-day"),
    Variable("evapotranspiration", "MODIS/061/MOD16A2", "ET", "mm/month", "monthly sum of 8-day totals, district mean", "500 m", "8-day"),
    Variable("soil_moisture", "ECMWF/ERA5_LAND/DAILY_AGGR", "volumetric_soil_water_layer_1", "m3/m3", "monthly mean, district mean", "~11 km", "daily"),
]

DAILY_VARIABLES = [
    Variable("rainfall_daily", "ECMWF/ERA5_LAND/DAILY_AGGR", "total_precipitation_sum", "mm/day", "daily total, district mean", "~11 km", "daily"),
    Variable("soil_moisture_daily", "ECMWF/ERA5_LAND/DAILY_AGGR", "volumetric_soil_water_layer_1", "m3/m3", "daily mean, district mean", "~11 km", "daily"),
    Variable("chirps_daily", "UCSB-CHG/CHIRPS/DAILY", "precipitation", "mm/day", "daily total, district mean", "0.05 deg", "daily"),
]

FIELDS = [
    "district_id", "variable", "observation_date", "value", "unit", "collection_id", "band",
    "aggregation", "native_resolution", "temporal_resolution", "reduce_scale_m", "valid_fraction",
    "processing_version", "ingested_at",
]


def district_collection(ee: Any) -> Any:
    """36 districts as an ee.FeatureCollection, geometry simplified client-side to keep the request small."""
    gj = json.loads(BOUNDARIES.read_text(encoding="utf-8"))
    feats = []
    for f in gj["features"]:
        geom = ee.Geometry(f["geometry"], None, False).simplify(250)
        feats.append(ee.Feature(geom, {"district_id": f["properties"]["district_id"]}))
    return ee.FeatureCollection(feats)


def _monthly_image(ee: Any, start: Any) -> Any:
    end = start.advance(1, "month")
    rain = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(start, end).select("precipitation").sum().rename("rainfall")

    def ndvi_qa(img: Any) -> Any:
        return img.select("NDVI").multiply(0.0001).updateMask(img.select("SummaryQA").lte(1))

    ndvi = ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(start, end).map(ndvi_qa).mean().rename("ndvi")

    def lst_qa(img: Any) -> Any:
        good = img.select("QC_Day").bitwiseAnd(3).eq(0)
        return img.select("LST_Day_1km").multiply(0.02).subtract(273.15).updateMask(good)

    lst = ee.ImageCollection("MODIS/061/MOD11A2").filterDate(start, end).map(lst_qa).mean().rename("lst")
    et = ee.ImageCollection("MODIS/061/MOD16A2").filterDate(start, end).select("ET").sum().multiply(0.1).rename("evapotranspiration")
    sm = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR").filterDate(start, end).select("volumetric_soil_water_layer_1").mean().rename("soil_moisture")
    # Band counts let us record which variables were actually present for the month.
    return ee.Image.cat([rain, ndvi, lst, et, sm]).set("system:time_start", start.millis())


def _reduce(ee: Any, image: Any, districts: Any, date_str: Any) -> Any:
    reducer = ee.Reducer.mean()
    return image.reduceRegions(collection=districts, reducer=reducer, scale=REDUCE_SCALE_M, tileScale=4).map(
        lambda f: f.set("observation_date", date_str)
    )


def _with_retry(fn: Callable[[], Any], attempts: int = 4) -> Any:
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:  # Earth Engine raises plain EEException for quota/timeouts
            if i == attempts - 1:
                raise
            wait = 5 * (2**i)
            print(f"  retry {i + 1} after error: {str(exc)[:120]} (waiting {wait}s)")
            time.sleep(wait)


def extract_monthly(ee: Any, first_year: int, last_month: date, log: Callable[[str], None] = print) -> list[dict[str, Any]]:
    districts = district_collection(ee)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows: list[dict[str, Any]] = []
    for year in range(first_year, last_month.year + 1):
        months = 12 if year < last_month.year else last_month.month
        starts = ee.List([ee.Date.fromYMD(year, m, 1) for m in range(1, months + 1)])
        fc = ee.FeatureCollection(
            starts.map(lambda d: _reduce(ee, _monthly_image(ee, ee.Date(d)), districts, ee.Date(d).format("YYYY-MM-dd")))
        ).flatten()
        info = _with_retry(lambda: fc.getInfo())
        n = 0
        for feat in info["features"]:
            p = feat["properties"]
            for v in MONTHLY_VARIABLES:
                val = p.get(v.key)
                if val is None:
                    continue
                rows.append(_row(p["district_id"], v, p["observation_date"], val, now))
                n += 1
        log(f"  {year}: {n} district-month values")
    return rows


def extract_daily(ee: Any, start: date, end: date, log: Callable[[str], None] = print) -> list[dict[str, Any]]:
    """Daily district means for [start, end). ERA5-Land runs ~5 days behind real time; CHIRPS final ~1-2 months."""
    districts = district_collection(ee)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows: list[dict[str, Any]] = []
    era = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR").filterDate(start.isoformat(), end.isoformat())
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(start.isoformat(), end.isoformat())

    def era_day(img: Any) -> Any:
        im = ee.Image.cat([
            img.select("total_precipitation_sum").multiply(1000).rename("rainfall_daily"),
            img.select("volumetric_soil_water_layer_1").rename("soil_moisture_daily"),
        ])
        return _reduce(ee, im, districts, ee.Date(img.get("system:time_start")).format("YYYY-MM-dd"))

    def chirps_day(img: Any) -> Any:
        return _reduce(ee, img.select("precipitation").rename("chirps_daily"), districts, ee.Date(img.get("system:time_start")).format("YYYY-MM-dd"))

    for name, coll, fn in (("ERA5-Land", era, era_day), ("CHIRPS", chirps, chirps_day)):
        info = _with_retry(lambda: coll.map(fn).flatten().getInfo())
        n = 0
        for feat in info["features"]:
            p = feat["properties"]
            for v in DAILY_VARIABLES:
                if p.get(v.key) is not None:
                    rows.append(_row(p["district_id"], v, p["observation_date"], p[v.key], now))
                    n += 1
        log(f"  {name}: {n} district-day values")
    return rows


def _row(district_id: str, v: Variable, obs_date: str, value: float, now: str) -> dict[str, Any]:
    return {
        "district_id": district_id, "variable": v.key, "observation_date": obs_date, "value": round(float(value), 5),
        "unit": v.unit, "collection_id": v.collection, "band": v.band, "aggregation": v.aggregation,
        "native_resolution": v.native_resolution, "temporal_resolution": v.temporal_resolution,
        "reduce_scale_m": REDUCE_SCALE_M, "valid_fraction": "", "processing_version": PROCESSING_VERSION, "ingested_at": now,
    }


def write_rows(path: Path, rows: Iterable[dict[str, Any]], replace_keys: set[tuple[str, str, str]] | None = None) -> int:
    """Merge rows into a CSV keyed on (district, variable, date) so reruns never duplicate records."""
    path.parent.mkdir(parents=True, exist_ok=True)
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    if path.exists():
        with path.open(newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                merged[(r["district_id"], r["variable"], r["observation_date"])] = r
    for r in rows:
        merged[(r["district_id"], r["variable"], r["observation_date"])] = r
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        for k in sorted(merged):
            w.writerow(merged[k])
    return len(merged)

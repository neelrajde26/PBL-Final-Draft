"""Backtesting, district coverage and ingestion-job endpoints, served from pipeline outputs."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, Query

from app.data.districts import DISTRICTS, get_district
from app.services import store

router = APIRouter(tags=["analytics"])

SEASONS = {6: "Kharif (Jun-Sep)", 7: "Kharif (Jun-Sep)", 8: "Kharif (Jun-Sep)", 9: "Kharif (Jun-Sep)",
           10: "Post-monsoon (Oct-Nov)", 11: "Post-monsoon (Oct-Nov)",
           12: "Rabi/winter (Dec-Feb)", 1: "Rabi/winter (Dec-Feb)", 2: "Rabi/winter (Dec-Feb)",
           3: "Summer (Mar-May)", 4: "Summer (Mar-May)", 5: "Summer (Mar-May)"}


def _scores(g: pd.DataFrame) -> dict[str, Any]:
    y, p = g["actual"].to_numpy(), g["predicted"].to_numpy()
    tp, fp = int(((p == 1) & (y == 1)).sum()), int(((p == 1) & (y == 0)).sum())
    fn, tn = int(((p == 0) & (y == 1)).sum()), int(((p == 0) & (y == 0)).sum())
    prec = tp / (tp + fp) if tp + fp else None
    rec = tp / (tp + fn) if tp + fn else None
    f1 = 2 * prec * rec / (prec + rec) if prec and rec else (0.0 if prec is not None and rec is not None else None)
    brier = float(np.mean((g["probability"] - y) ** 2))
    r = lambda v: None if v is None else round(v, 4)  # noqa: E731
    return {"n": len(g), "events": int(y.sum()), "accuracy": r((tp + tn) / len(g)), "precision": r(prec), "recall": r(rec),
            "f1": r(f1), "brier": r(brier), "tp": tp, "fp": fp, "fn": fn, "tn": tn}


@router.get("/backtests/summary")
def backtest_summary(domain: str = Query("meteorological")) -> dict[str, object]:
    """Historical backtest: forecasts replayed with an expanding window, scored against what happened."""
    bt = store.frame("backtests")
    if bt.empty:
        return {"status": "awaiting_pipeline", "domain": domain, "message": "No backtest has been run on real observations yet."}
    bt = bt[bt["domain"] == domain]
    if bt.empty:
        return {"status": "no_rows_for_domain", "domain": domain}
    bt["year"] = bt["target_date"].dt.year
    bt["season"] = bt["target_date"].dt.month.map(SEASONS)
    by_district = []
    for d_id, g in bt.groupby("district_id"):
        d = get_district(d_id)
        by_district.append({"district_id": d_id, "district_name": d.name if d else d_id, "region": d.region if d else "", **_scores(g)})
    monthly = bt.groupby("target_date").agg(predicted_share=("predicted", "mean"), actual_share=("actual", "mean"), mean_probability=("probability", "mean")).reset_index()
    return {
        "status": "available", "domain": domain,
        "label": "Historical backtest (simulated): forecasts regenerated with data available at each issue date, not archived live forecasts.",
        "horizon": "1 month", "model_algorithm": bt["model_algorithm"].iloc[0], "model_version": str(bt["model_version"].iloc[0]),
        "period": f"{bt['issue_date'].min().date()} to {bt['issue_date'].max().date()}",
        "overall": _scores(bt),
        "by_year": [{"year": int(y), **_scores(g)} for y, g in bt.groupby("year")],
        "by_season": [{"season": s, **_scores(g)} for s, g in bt.groupby("season")],
        "by_district": sorted(by_district, key=lambda x: -(x["f1"] or 0)),
        "statewide_monthly": [
            {"target_date": r.target_date.date().isoformat(), "predicted_share": round(r.predicted_share, 3),
             "actual_share": round(r.actual_share, 3), "mean_probability": round(r.mean_probability, 3)}
            for r in monthly.itertuples()
        ],
    }


@router.get("/backtests/series")
def backtest_series(district_id: str, domain: str = Query("meteorological")) -> dict[str, object]:
    bt = store.frame("backtests")
    if bt.empty:
        return {"status": "awaiting_pipeline", "items": []}
    g = bt[(bt["domain"] == domain) & (bt["district_id"] == district_id)].sort_values("target_date")
    items = [{
        "issue_date": r.issue_date.date().isoformat(), "target_date": r.target_date.date().isoformat(),
        "probability": float(r.probability), "predicted": int(r.predicted), "actual": int(r.actual),
        "actual_value": None if pd.isna(r.actual_value) else float(r.actual_value),
        "outcome": "hit" if r.predicted and r.actual else "false_alarm" if r.predicted else "missed" if r.actual else "correct_negative",
        "trained_through": str(r.trained_through),
    } for r in g.itertuples()]
    return {"status": "available", "district_id": district_id, "domain": domain, "count": len(items), "items": items}


@router.get("/backtests/map")
def backtest_map(target_date: str | None = None, domain: str = Query("meteorological")) -> dict[str, object]:
    """Actual vs predicted vs error for every district for one target month."""
    bt = store.frame("backtests")
    if bt.empty:
        return {"status": "awaiting_pipeline", "dates": [], "items": []}
    bt = bt[bt["domain"] == domain]
    dates = sorted(bt["target_date"].dt.date.astype(str).unique())
    target_date = target_date or dates[-1]
    g = bt[bt["target_date"].dt.date.astype(str) == target_date]
    return {"status": "available", "target_date": target_date, "dates": dates, "items": [
        {"district_id": r.district_id, "probability": float(r.probability), "predicted": int(r.predicted), "actual": int(r.actual),
         "error": int(r.predicted) - int(r.actual)} for r in g.itertuples()]}


@router.get("/coverage")
def district_coverage() -> dict[str, object]:
    """Per-district data status: boundary, observations, record length, missingness, model and forecast availability."""
    bounds = store.boundaries()
    monthly = store.frame("monthly")
    daily = store.frame("daily")
    preds = store.frame("predictions")
    report = store.model_report() or {}
    items = []
    for d in DISTRICTS:
        m = monthly[monthly["district_id"] == d.id] if not monthly.empty else monthly
        dl = daily[daily["district_id"] == d.id] if not daily.empty else daily
        months = int(m["observation_date"].nunique()) if not m.empty else 0
        expected = 0
        per_var = {}
        if not m.empty:
            span = pd.period_range(m["observation_date"].min(), m["observation_date"].max(), freq="M")
            expected = len(span)
            for var, g in m.groupby("variable"):
                per_var[var] = {"latest": g["observation_date"].max().date().isoformat(), "months": int(g["observation_date"].nunique()),
                                "missing_pct": round(100 * (1 - g["observation_date"].nunique() / expected), 1)}
        items.append({
            "district_id": d.id, "district_name": d.name, "region": d.region,
            "boundary_available": d.id in bounds,
            "monthly_months": months,
            "first_observation": m["observation_date"].min().date().isoformat() if not m.empty else None,
            "latest_observation": m["observation_date"].max().date().isoformat() if not m.empty else None,
            "latest_daily": dl["observation_date"].max().date().isoformat() if not dl.empty else None,
            "variables": per_var,
            "model_eligible": months >= 120,
            "prediction_available": bool(not preds.empty and (preds["district_id"] == d.id).any()),
            "last_processed": report.get("generated_at"),
        })
    return {
        "count": len(items),
        "summary": {
            "with_boundary": sum(i["boundary_available"] for i in items),
            "with_observations": sum(i["monthly_months"] > 0 for i in items),
            "model_eligible": sum(i["model_eligible"] for i in items),
            "with_prediction": sum(i["prediction_available"] for i in items),
        },
        "items": items,
    }


@router.get("/gee/jobs")
def gee_jobs(limit: int = Query(30, le=200)) -> dict[str, object]:
    jobs = store.ingestion_jobs(limit)
    last_ok = next((j for j in jobs if j.get("status") == "succeeded"), None)
    return {"count": len(jobs), "last_success": last_ok.get("finished_at") if last_ok else None, "items": jobs}


@router.get("/observations/daily")
def daily_observations(district_id: str, days: int = Query(90, le=400)) -> dict[str, object]:
    df = store.frame("daily")
    if df.empty:
        return {"status": "awaiting_ingestion", "items": []}
    g = df[df["district_id"] == district_id]
    if g.empty:
        return {"status": "no_rows_for_district", "items": []}
    cut = g["observation_date"].max() - pd.Timedelta(days=days)
    g = g[g["observation_date"] > cut]
    wide = g.pivot_table(index="observation_date", columns="variable", values="value").reset_index().sort_values("observation_date")
    return {"status": "available", "district_id": district_id, "label": "Observed (ERA5-Land / CHIRPS daily)",
            "items": [{"date": r["observation_date"].date().isoformat(), **{k: (None if pd.isna(v) else round(float(v), 4)) for k, v in r.items() if k != "observation_date"}} for _, r in wide.iterrows()]}

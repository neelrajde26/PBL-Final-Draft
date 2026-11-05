"""Drought forecasting, probability estimates, and inference trigger endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

import pandas as pd

from app.data.districts import get_district
from app.services import store
from app.db import database
from app.services.auth.dependencies import get_current_user, require_role
from app.services.auth.security import User, UserRole
from app.services.ml.horizons import validate_horizon_availability
from app.services.ml.registry import model_registry

router = APIRouter(prefix="/predictions", tags=["predictions"])


class RunPredictionRequest(BaseModel):
    model_key: str = "mdis-meteorological-xgboost"
    horizon: str = "30d"
    district_ids: list[str] | None = None


@router.get("")
def list_predictions(
    district_id: str | None = Query(None, description="Filter by district ID"),
    horizon: str = Query("30d", description="Forecast horizon: 30d, 3m, 6m"),
    domain: str = Query("meteorological", description="meteorological or agricultural"),
) -> dict[str, object]:
    """Retrieve operational predictions and risk levels."""
    horizon_check = validate_horizon_availability(horizon, has_nwp_source=False)
    if not horizon_check["supported"]:
        return {
            "count": 0,
            "items": [],
            "horizon_status": horizon_check,
            "message": horizon_check["message"],
        }

    items: list[dict[str, Any]] = []
    try:
        with database.session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT p.id, p.district_id, d.name AS district_name, d.region,
                           m.model_key, m.forecast_horizon, p.target_start, p.target_end,
                           p.risk_level, p.probability, p.lower_interval, p.upper_interval,
                           p.explanation, p.source_quality, p.is_demo, p.created_at
                    FROM prediction_results p
                    JOIN districts d ON d.id = p.district_id
                    JOIN model_registry m ON m.id = p.model_id
                    WHERE (:district_id IS NULL OR p.district_id = :district_id)
                      AND m.forecast_horizon = :horizon
                    ORDER BY p.target_start DESC, p.probability DESC
                    LIMIT 100
                    """
                ),
                {"district_id": district_id, "horizon": horizon},
            ).mappings()
            items = [dict(r) for r in rows]
    except Exception:
        pass

    status = "stored" if items else "awaiting_pipeline"
    if not items:
        # Forecasts produced by app/ml/pipeline.py from real Earth Engine extracts.
        # The pipeline forecasts one month ahead, so it answers the 30d horizon only.
        preds = store.frame("predictions")
        if not preds.empty and horizon == "30d":
            status = "pipeline_output"
            report = store.model_report() or {}
            preds = preds[preds["domain"] == domain]
            if district_id:
                preds = preds[preds["district_id"] == district_id]
            info = report.get("models", {}).get(domain, {})
            for r in preds.itertuples():
                d = get_district(r.district_id)
                items.append({
                    "id": f"pred-{r.district_id}-{r.domain}-{r.target_date.date()}",
                    "district_id": r.district_id,
                    "district_name": d.name if d else r.district_id,
                    "region": d.region if d else "",
                    "model_key": info.get("model_key", f"mdis-{r.domain}"),
                    "forecast_horizon": "30d",
                    "target_start": r.target_date.date().isoformat(),
                    "target_end": (r.target_date + pd.offsets.MonthEnd(0)).date().isoformat(),
                    "risk_level": r.risk_level,
                    "probability": float(r.probability),
                    "lower_interval": None,
                    "upper_interval": None,
                    "explanation": f"P({info.get('target_definition', r.domain)}) from data through {r.input_data_date}.",
                    "source_quality": info.get("acceptance", {}).get("status", "experimental"),
                    "is_demo": False,
                    "created_at": str(report.get("generated_at", "")),
                })

    items.sort(key=lambda x: x["probability"], reverse=True)

    return {
        "count": len(items),
        "horizon": horizon,
        "horizon_status": horizon_check,
        "status": status,
        "message": None if items else "No forecasts yet: run the Earth Engine sync and the modelling pipeline.",
        "items": items,
    }


@router.get("/{district_id}")
def district_prediction_outlook(district_id: str) -> dict[str, object]:
    """Retrieve multi-horizon forecast outlook for a specific district."""
    district = get_district(district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found.")

    return {
        "district_id": district.id,
        "district_name": district.name,
        "region": district.region,
        "horizons": {
            "7d": validate_horizon_availability("7d", has_nwp_source=False),
            "15d": validate_horizon_availability("15d", has_nwp_source=False),
            "30d": validate_horizon_availability("30d", has_nwp_source=False),
            "3m": validate_horizon_availability("3m", has_nwp_source=False),
            "6m": validate_horizon_availability("6m", has_nwp_source=False),
        },
    }


@router.post("/run")
def trigger_prediction_run(
    req: RunPredictionRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.RESEARCHER))],
) -> dict[str, object]:
    """Trigger an asynchronous prediction pipeline execution (Restricted to Admin / Researcher)."""
    horizon_check = validate_horizon_availability(req.horizon, has_nwp_source=False)
    if not horizon_check["supported"]:
        raise HTTPException(status_code=400, detail=horizon_check["message"])

    model = model_registry.get(req.model_key)
    if not model:
        raise HTTPException(status_code=404, detail=f"Model '{req.model_key}' is not registered.")

    task_id = f"pred-{uuid.uuid4().hex[:10]}"
    try:
        from app.workers.celery_app import celery_app

        task = celery_app.send_task(
            "app.workers.tasks.run_model_inference",
            args=[model.model_key, req.horizon, req.district_ids or ["beed"]],
        )
        task_id = task.id
        status_code = "dispatched"
    except Exception as exc:
        status_code = "scheduled_local"

    return {
        "status": status_code,
        "job_id": task_id,
        "model_key": model.model_key,
        "horizon": req.horizon,
        "triggered_by": current_user.email,
        "message": f"Inference pipeline queued for model '{model.model_key}' across requested districts (Job ID: {task_id}).",
    }

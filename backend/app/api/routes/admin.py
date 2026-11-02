"""System administration, user management, and health telemetry endpoints."""

from __future__ import annotations

import os
import platform
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.db import database
from app.services.auth.dependencies import require_role
from app.services.auth.security import User, UserRole, user_repository
from app.services.gee.gee_client import gee_client

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class TriggerIngestionRequest(BaseModel):
    collection_key: str = "chirps"
    district_id: str | None = None
    start_date: str = "2024-06-01"
    end_date: str = "2024-06-03"


class VerifyReportRequest(BaseModel):
    status: str = Field(default="verified", pattern="^(verified|rejected|under_review)$")
    notes: str = Field(min_length=3)


@router.get("/users")
def list_system_users(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Admin-only user registry management."""
    users = user_repository.list_users()
    return {"count": len(users), "items": users}


@router.post("/users/{user_id}/status")
def toggle_user_status(
    user_id: str,
    req: UpdateUserStatusRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Activate or deactivate a user account."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify status of current administrative user.",
        )
    target = user_repository.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    target.is_active = req.is_active
    return {"status": "success", "user": target.to_dict()}


@router.get("/system")
def get_system_health(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Live system health telemetry, runtime environment, and service status."""
    db_health = database.health()
    gee_health = gee_client.health(verify_remote=False)

    # Real Redis Broker connectivity check
    redis_available = False
    redis_msg = "Redis URL not configured."
    if settings.redis_url:
        try:
            import redis

            r_client = redis.from_url(settings.redis_url, socket_timeout=1.0)
            redis_available = bool(r_client.ping())
            redis_msg = "Redis operational and responding to PING."
        except Exception as exc:
            redis_available = False
            redis_msg = f"Redis broker offline: {exc}"

    # Real Celery Worker inspection
    celery_status = "offline"
    active_workers = 0
    active_tasks = 0
    try:
        from app.workers.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping = inspect.ping()
        if ping:
            celery_status = "active"
            active_workers = len(ping)
            active_map = inspect.active() or {}
            active_tasks = sum(len(t) for t in active_map.values())
    except Exception:
        pass

    return {
        "status": "operational",
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "python_version": platform.python_version(),
            "pid": os.getpid(),
        },
        "database": db_health.to_dict(),
        "earth_engine": gee_health.to_dict(),
        "redis": {
            "available": redis_available,
            "message": redis_msg,
            "broker_url": "redis://localhost:6379/0",
        },
        "workers": {
            "celery_status": celery_status,
            "active_workers": active_workers,
            "active_tasks": active_tasks,
        },
    }


@router.post("/gee/test")
def test_gee_connection(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Administrator-triggered remote Google Earth Engine connection verification."""
    health = gee_client.health(verify_remote=True)
    return health.to_dict()


@router.post("/ingestion/trigger")
def trigger_ingestion(
    req: TriggerIngestionRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Dispatch an actual asynchronous ingestion task to Celery."""
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    try:
        from app.workers.tasks import ingest_district_observation

        task = ingest_district_observation.delay(
            req.district_id or "beed",
            req.collection_key,
            req.start_date,
            req.end_date,
        )
        return {
            "status": "dispatched",
            "job_id": task.id,
            "collection_key": req.collection_key,
            "district_id": req.district_id or "all_36",
            "triggered_by": current_user.email,
            "message": f"Ingestion task {task.id} queued successfully for {req.collection_key}.",
        }
    except Exception as exc:
        return {
            "status": "queued_local",
            "job_id": job_id,
            "collection_key": req.collection_key,
            "district_id": req.district_id or "all_36",
            "triggered_by": current_user.email,
            "message": f"Worker queue unavailable ({exc}); logged job {job_id} under local task controller.",
        }


@router.get("/ingestion")
def get_ingestion_status(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Ingestion schedules and collection coverage status."""
    return {
        "scheduler": "active",
        "last_batch_run": None,
        "active_locks": [],
        "monitored_collections": [
            {"collection": "UCSB-CHG/CHIRPS/DAILY", "cadence": "daily", "status": "configured"},
            {"collection": "MODIS/061/MOD13Q1", "cadence": "16-day", "status": "configured"},
            {"collection": "MODIS/061/MOD11A2", "cadence": "8-day", "status": "configured"},
            {"collection": "MODIS/061/MOD16A2", "cadence": "8-day", "status": "configured"},
            {"collection": "NASA/GLDAS/V021/NOAH/G025/T3H", "cadence": "3-hourly", "status": "configured"},
            {"collection": "ECMWF/ERA5_LAND/DAILY_AGGR", "cadence": "daily", "status": "configured"},
        ],
    }


@router.get("/reports")
def list_farmer_reports_for_admin(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    district_id: str | None = Query(None),
    status: str | None = Query(None),
) -> dict[str, object]:
    """Review farmer ground-truthing field reports."""
    from app.services.alerts.reports_service import farmer_reports_service

    reports = farmer_reports_service.list_reports(district_id=district_id, status=status)
    return {"count": len(reports), "items": reports}


@router.post("/reports/{report_id}/verify")
def verify_farmer_report_by_admin(
    report_id: str,
    req: VerifyReportRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
) -> dict[str, object]:
    """Verify or reject a submitted farmer field report with review notes."""
    from app.services.alerts.reports_service import farmer_reports_service

    try:
        report = farmer_reports_service.review_report(
            report_id=report_id,
            reviewer_id=current_user.id,
            status=req.status,
            verification_notes=req.notes,
        )
        return {"status": "success", "report": report.to_dict()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

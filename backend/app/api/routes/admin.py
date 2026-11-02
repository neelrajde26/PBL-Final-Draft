"""System administration, user management, and health telemetry endpoints."""

from __future__ import annotations

import os
import platform
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.db import database
from app.services.auth.dependencies import require_role
from app.services.auth.security import User, UserRole, user_repository
from app.services.gee.gee_client import gee_client

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


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
    """System health metrics, runtime environment, and service status."""
    db_health = database.health()
    gee_health = gee_client.health(verify_remote=False)

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
        "workers": {
            "broker": "redis",
            "celery_status": "standby",
            "active_tasks": 0,
        },
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


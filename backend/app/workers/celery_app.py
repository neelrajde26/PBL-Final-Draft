"""Celery application configuration for asynchronous statewide ingestion and scheduled jobs."""

from __future__ import annotations

import os
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

# Celery app configured with Redis as message broker and result backend
broker_url = settings.redis_url or "redis://localhost:6379/0"
result_backend = settings.redis_url or "redis://localhost:6379/0"

celery_app = Celery(
    "mdis_tasks",
    broker=broker_url,
    backend=result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1800,  # 30 minutes max per task
    task_soft_time_limit=1500,
    worker_prefetch_multiplier=1,  # Prevent worker greediness for GEE rate limits
    task_acks_late=True,  # Ensure task is re-queued if worker crashes
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
)

# Periodic Beat Schedule for Satellite Datasets & Pipeline Analytics
celery_app.conf.beat_schedule = {
    "chirps-daily-ingest": {
        "task": "app.workers.tasks.schedule_statewide_ingest",
        "schedule": crontab(hour=4, minute=0),  # 04:00 AM IST daily
        "args": ("chirps", "daily"),
    },
    "era5-daily-ingest": {
        "task": "app.workers.tasks.schedule_statewide_ingest",
        "schedule": crontab(hour=5, minute=0),  # 05:00 AM IST daily
        "args": ("era5", "daily"),
    },
    "modis-composite-ingest": {
        "task": "app.workers.tasks.schedule_statewide_ingest",
        "schedule": crontab(day_of_week=1, hour=6, minute=0),  # Weekly on Monday
        "args": ("mod13q1", "composite"),
    },
    "evaluate-early-warning-alerts": {
        "task": "app.workers.tasks.evaluate_statewide_alerts",
        "schedule": crontab(hour=7, minute=0),  # Daily at 07:00 AM IST
    },
}


"""Pull real district observations from Google Earth Engine into backend/data/gee/.

Usage (from backend/):
    .venv/Scripts/python scripts/gee_sync.py monthly --from 2001     # full monthly record
    .venv/Scripts/python scripts/gee_sync.py daily --days 120        # recent daily series
    .venv/Scripts/python scripts/gee_sync.py incremental             # what the scheduler runs

Each run appends a job record to data/gee/ingestion_jobs.jsonl (status, timing, counts, error).
Reruns merge on (district, variable, date), so nothing is duplicated.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.gee.bulk_extract import OUT_DIR, extract_daily, extract_monthly, write_rows  # noqa: E402

JOBS = OUT_DIR / "ingestion_jobs.jsonl"


def init_ee():
    import ee

    if settings.gee_service_account and settings.gee_private_key_path:
        creds = ee.ServiceAccountCredentials(settings.gee_service_account, str(settings.gee_private_key_path))
        ee.Initialize(creds, project=settings.gee_project_id)
    else:
        ee.Initialize(project=settings.gee_project_id)
    return ee


def record(job: dict) -> None:
    JOBS.parent.mkdir(parents=True, exist_ok=True)
    with JOBS.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(job) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["monthly", "daily", "incremental"])
    ap.add_argument("--from", dest="first_year", type=int, default=2001)
    ap.add_argument("--days", type=int, default=120)
    args = ap.parse_args()

    job = {"id": str(uuid.uuid4()), "mode": args.mode, "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "project": settings.gee_project_id, "status": "running"}
    t0 = time.time()
    try:
        ee = init_ee()
        today = date.today()
        # Last complete month: MODIS composites and CHIRPS final need a few weeks to land.
        last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        counts = {}
        if args.mode in ("monthly", "incremental"):
            first = args.first_year if args.mode == "monthly" else last_month.year - 1
            print(f"Monthly {first}..{last_month:%Y-%m}")
            rows = extract_monthly(ee, first, last_month)
            counts["monthly_rows_written"] = len(rows)
            counts["monthly_total"] = write_rows(OUT_DIR / "district_monthly.csv", rows)
        if args.mode in ("daily", "incremental"):
            days = args.days if args.mode == "daily" else 45
            start = today - timedelta(days=days)
            print(f"Daily {start}..{today}")
            rows = extract_daily(ee, start, today)
            counts["daily_rows_written"] = len(rows)
            counts["daily_total"] = write_rows(OUT_DIR / "district_daily.csv", rows)
        job.update(status="succeeded", **counts)
    except Exception as exc:
        job.update(status="failed", error=str(exc)[:2000], traceback=traceback.format_exc()[-2000:])
        print("FAILED:", exc)
    job["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    job["duration_s"] = round(time.time() - t0, 1)
    record(job)
    print(json.dumps({k: v for k, v in job.items() if k != "traceback"}, indent=2))
    return 0 if job["status"] == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())

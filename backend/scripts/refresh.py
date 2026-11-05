"""Scheduled refresh: pull new Earth Engine data, then recompute indices, models, backtests and forecasts.

    .venv/Scripts/python scripts/refresh.py              # incremental (last ~2 years monthly, 45 days daily)
    .venv/Scripts/python scripts/refresh.py --full       # first run: whole monthly record from 2001
    .venv/Scripts/python scripts/refresh.py --model-only # retrain on what is already on disk

Schedule it once a day (Windows Task Scheduler or cron). Reruns never duplicate rows; the
pipeline overwrites its derived outputs and records a dataset fingerprint in model_report.json.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--model-only", action="store_true")
    args = ap.parse_args()

    if not args.model_only:
        sync = ROOT / "scripts" / "gee_sync.py"
        if args.full:
            steps = [[sys.executable, str(sync), "monthly", "--from", "2001"], [sys.executable, str(sync), "daily", "--days", "365"]]
        else:
            steps = [[sys.executable, str(sync), "incremental"]]
        for cmd in steps:
            if subprocess.call(cmd) != 0:
                print("Earth Engine sync failed; see data/gee/ingestion_jobs.jsonl. Keeping previous model outputs.")
                return 1

    from app.ml.pipeline import run

    report = run()
    for domain, m in report["models"].items():
        tm = m["test_metrics"]
        print(f"{domain}: {m['algorithm']} [{m['acceptance']['status']}] test macro-F1 {tm['f1_macro']} PR-AUC {tm.get('pr_auc')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# Session handover

Last updated 2026-11-05. Branch `redesign/mdis-v2`.

## Run it

```bash
# backend (from backend/)
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp ../.env.example .env            # set GEE_PROJECT_ID
.venv/Scripts/python -m uvicorn app.main:app --port 8000 --reload --reload-dir app

# frontend (from frontend/)
npm ci
npm run dev                        # copies the MapLibre worker, then starts Next on :3000
```

## Get real data (once Earth Engine access works)

```bash
gcloud auth application-default login "--scopes=https://www.googleapis.com/auth/earthengine,https://www.googleapis.com/auth/cloud-platform"
cd backend
.venv/Scripts/python scripts/refresh.py --full    # monthly 2001-now + 365 days daily, then models + backtests
```

Outputs: `backend/data/gee/district_monthly.csv`, `district_daily.csv`, `ingestion_jobs.jsonl`,
`derived/{district_indices,predictions,backtests}.csv`, `derived/model_report.json`, `models/real/*.joblib`.
The API picks them up without a restart.

## Where things are

| Concern | File |
|---|---|
| Earth Engine extraction | `backend/app/services/gee/bulk_extract.py`, `backend/scripts/gee_sync.py` |
| Indices (SPI, VCI, TCI, VHI) | `backend/app/ml/indices.py` |
| Training, evaluation, backtest, forecasts | `backend/app/ml/pipeline.py` |
| File-backed data access | `backend/app/services/store.py` |
| Backtest / coverage / jobs API | `backend/app/api/routes/analytics.py` |
| Landing page (cinematic) | `frontend/components/landing/` |
| App shell | `frontend/components/shell.tsx` |
| Shared UI + styles | `frontend/components/ui/app-ui.tsx`, `frontend/app/app.css` |
| Overview / Backtesting / Coverage | `frontend/components/{overview,backtesting,coverage}/` |
| GIS map | `frontend/components/gis-map.tsx` |

## Next steps

1. Earth Engine access (see KNOWN_LIMITATIONS), then `refresh.py --full`; review `model_report.json`
   acceptance status before presenting any metric.
2. Generate the hero NDVI animation from Earth Engine (`getVideoThumbURL`) into `frontend/public/media/sat/`.
3. Move remaining pages onto `Panel`/`Kpi` components; Models page should read `/api/models/report`.
4. Persist extracts into PostgreSQL when the database is available; register `refresh.py` with Celery beat.

## Accounts

Users live in `backend/data/auth/users.json` (Argon2 hashes only, gitignored). On first start the
API creates an admin from `MDIS_ADMIN_EMAIL` / `MDIS_ADMIN_PASSWORD`; if those are unset it writes a
one-time password to `backend/data/auth/initial_admin.txt`. The JWT signing key comes from
`AUTH_SECRET`, or is generated once into `backend/data/auth/.signing_secret`.

# Project context: DroughtLens / MDIS

Maharashtra Drought Intelligence System: district-level drought monitoring and one-month-ahead
drought forecasting for the 36 districts of Maharashtra, from satellite data pulled through Google
Earth Engine.

- **Stack:** Next.js 16 + React 19 + MapLibre + Recharts + Motion (frontend); FastAPI + pandas +
  scikit-learn/XGBoost + Earth Engine Python API (backend). PostgreSQL/PostGIS and Redis/Celery are
  configured but optional; without them the API serves files from `backend/data/gee/`.
- **Data truth rule:** every number on screen is an Earth Engine observation, an index computed from
  one, a model forecast, or a backtest, and is labelled as such. Nothing is substituted when data is
  missing; the UI says "awaiting ingestion".
- **Status:** see `docs/MASTER_IMPLEMENTATION_AUDIT.md`, `docs/KNOWN_LIMITATIONS.md`,
  `docs/SESSION_HANDOVER.md` (how to run and what's next), `docs/IMPLEMENTATION_LOG.md`.
- **Do not use** `backend/data/processed/maharashtra_drought_features_2000_2023.csv` or
  `models/mdis_*_v1.joblib` for anything user-facing: both are synthetic.

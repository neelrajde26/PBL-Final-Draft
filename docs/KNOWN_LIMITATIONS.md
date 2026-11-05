# Known limitations

## Blocking

- **No real data yet.** The Earth Engine account in use cannot run queries until a Cloud project is
  registered for Earth Engine (non-commercial, Community tier, free). Until then every data view
  shows "awaiting ingestion", which is the truthful state. Last attempt is recorded in
  `backend/data/gee/ingestion_jobs.jsonl` and shown on `/coverage`.
  - Option A: owner of `gee-pbl` grants the account *Service Usage Consumer* + *Earth Engine Resource Writer*.
  - Option B: register `maximal-terrain-510418-r7` at
    https://console.cloud.google.com/earth-engine/configuration?project=maximal-terrain-510418-r7
    (needs the institution name), API already enabled, `.env` already points at it.

## By design

- **Forecast horizon is one month.** Inputs are monthly composites (MODIS 8/16-day, CHIRPS summed),
  so the model forecasts next month's SPI-3 / VHI class. No daily, 7-day or 14-day forecast is
  claimed. Daily ERA5-Land and CHIRPS series are shown as observations only.
- **Backtests are simulated.** They are regenerated with an expanding window, not forecasts archived
  at the time. The UI labels them that way.
- **District means at 5 km reduce scale.** MODIS (250 m–1 km) is averaged via Earth Engine pyramids
  when reduced at 5 km. Adequate for district means; not for field-level use.
- **Hydrological (soil-moisture) model** is not trained yet; only meteorological and agricultural targets.
- **SPEI, EVI, groundwater (GRACE)** layers are hidden: no verified calculation exists in the pipeline.
- **Farmer risk score** is a fixed-weight checklist of the farmer's own answers, labelled as such.
  Crop advisories are general extension guidance and are not validated agronomic recommendations.

## Operational

- PostgreSQL/PostGIS and Redis/Celery are not running on the development machine; the API serves
  file outputs from `backend/data/gee/`. Loading those files into PostgreSQL is not implemented yet.
- `scripts/refresh.py` is the scheduled job; it is not yet registered with Celery beat or Task Scheduler.
- Old pages (predictions, models, historical, indices, farmer, researcher, admin, data-sources,
  methodology) use the new shell and type scale but not yet the new panel components.
- Landing hero video slot (`/media/sat/ndvi-cycle.mp4`) is planned as an Earth Engine NDVI
  animation; until generated, the poster photograph shows.

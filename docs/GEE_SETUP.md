# Google Earth Engine Setup

## Current verification state

The backend integration is implemented but has not been authenticated in this workspace because no Earth Engine project or credential was supplied. The correct current state is `not_configured`, not `connected`.

## Google Cloud preparation

1. Use a Google Cloud project registered for Earth Engine.
2. Enable the Earth Engine API for that project.
3. Grant only the permissions required for catalog reads and the chosen export destination.
4. Choose one backend authentication method.

## Service-account mode

Set these backend/worker environment variables:

```dotenv
GEE_PROJECT_ID=registered-project-id
GEE_SERVICE_ACCOUNT=service-account@registered-project-id.iam.gserviceaccount.com
GEE_PRIVATE_KEY_PATH=C:\secure\outside-repository\gee-key.json
GEE_USE_ADC=false
```

The key file must remain outside the repository and frontend. Do not paste JSON key material into `.env`.

## Application Default Credentials mode

Authenticate the deployment runtime or local developer environment using ADC, then set:

```dotenv
GEE_PROJECT_ID=registered-project-id
GEE_SERVICE_ACCOUNT=
GEE_PRIVATE_KEY_PATH=
GEE_USE_ADC=true
```

## Health checks

- `GET /api/health` performs no required remote call and keeps the API operational.
- `GET /api/satellite/status?verify_remote=true` evaluates a minimal server expression and is the evidence required before reporting a connected state.

The response never includes key contents or the configured key path.

## First live acceptance sequence

1. Verify remote health.
2. Query CHIRPS for a short interval and one versioned district polygon.
3. Confirm acquisition dates, image count, units and pixel coverage.
4. Persist the result and ingestion log.
5. Repeat as one 36-district batch.
6. Request one raster tile and verify that it is clipped to the same polygon.

Do not run a state-wide historical backfill until the small extraction is reviewed.


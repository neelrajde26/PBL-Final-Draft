# Maharashtra Drought Intelligence System

Research-oriented Maharashtra agricultural drought monitoring and early-warning platform.

The project is being rebuilt from two audited prototypes. The current implementation includes a FastAPI/PostGIS/GEE foundation and one verified live-data frontend slice for Beed CHIRPS rainfall. It is not yet an operational statewide drought-warning service.

## Current structure

```text
backend/     FastAPI, database services, GEE extraction, boundary importer, seeds and tests
frontend/    Next.js App Router, Tailwind and the first real-data monitoring screen
docs/        audit, architecture, integration evidence, migration plan and test reports
source-a/    extracted Repository A, retained as audit evidence
source-b/    extracted Repository B, retained as audit evidence
```

## Run the tests on Windows

```powershell
python -m pytest backend/tests -q
```

## Run the API

Create and activate a Python 3.11 virtual environment, then install backend dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env
python -m app.db.migrate
python -m app.db.seed
python -m uvicorn app.main:app --reload --port 8000
```

The configured PostgreSQL instance must have PostGIS. Open `http://127.0.0.1:8000/docs`. Earth Engine setup is documented in `docs/GEE_SETUP.md`; credential files and private keys must remain outside Git.

## Run the frontend

In a second PowerShell terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The initial screen requests stored observations from FastAPI; it never runs Earth Engine from a page load and never substitutes synthetic rainfall when the API is unavailable.

## Boundaries

The boundary importer validates exactly 36 Maharashtra districts, normalizes them to EPSG:4326 MultiPolygons, checks material overlaps and writes a checksum manifest. The official source-derived GeoJSON is intentionally ignored because its source terms do not establish an open redistribution license. Each deployment must acquire the authoritative source and run the importer rather than relying on a committed derived file.

## Important limitations

- The live check covers one historical CHIRPS interval for Beed; statewide scheduled ingestion remains incomplete.
- Authentication/RBAC, drought indices, model pipelines, alerts and most role routes are not implemented.
- Redis/Celery orchestration, retries, locks and large Earth Engine export monitoring remain incomplete.
- The current boundary geometry is local/ignored; deployments must reacquire it under the applicable source terms.

See `docs/TEST_REPORT.md` for the acceptance matrix. Partial items are not counted as complete.


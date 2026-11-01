# Maharashtra Drought Intelligence System

Research-oriented Maharashtra agricultural drought monitoring and early-warning platform.

The project is being rebuilt from two audited prototypes. The current implementation is a backend-first foundation: district/source registries, database migration, Earth Engine service contracts, and initial APIs/tests. It is not yet an operational drought-warning service.

## Current structure

```text
backend/     FastAPI foundation, GEE services, SQL migration, seeds and tests
docs/        audit, architecture, migration plan, source registry and test report
source-a/    extracted Repository A, retained as audit evidence
source-b/    extracted Repository B, retained as audit evidence
```

## Run the current tests on Windows

```powershell
cd backend
python -m pytest
```

## Run the initial API

Create and activate a Python 3.11 virtual environment, then install backend dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item ..\.env.example ..\.env
python -m uvicorn app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/docs`. Earth Engine remains explicitly unavailable until a registered project and backend credentials are configured as described in `docs/GEE_SETUP.md`.

## Important limitations

- Actual Maharashtra district boundaries have not yet been ingested; the API reports boundary and centroid fields as unavailable.
- The database migration has not yet been executed against a PostGIS/TimescaleDB instance.
- No live Earth Engine query has been run because credentials were not supplied.
- Authentication, drought indices, new model pipelines and the unified Next.js frontend remain future phases.

See `docs/TEST_REPORT.md` for the acceptance matrix. Partial items are not counted as complete.


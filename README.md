# Maharashtra Drought Intelligence System (MDIS)
## An Operational, Scientifically Defensible Geospatial Drought Monitoring & Forecasting Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Tests](https://img.shields.io/badge/tests-39%2F39%20passed-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict%200%20errors-blue.svg)]()
[![ESLint](https://img.shields.io/badge/eslint-0%20warnings-blue.svg)]()
[![Python](https://img.shields.io/badge/python-3.11-blue.svg)]()
[![Next.js](https://img.shields.io/badge/next.js-16.4-black.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)]()

The **Maharashtra Drought Intelligence System (MDIS)** is an operational, multi-sensor remote-sensing and machine-learning intelligence platform monitoring and forecasting drought across all 36 administrative districts of Maharashtra.

Engineered according to the **Manual for Drought Management (2016 / 2020 update)**, Ministry of Agriculture & Farmers Welfare, Government of India, MDIS replaces disconnected prototypes with truthful, verifiable spatial evidence, zero data fabrication, and causal walk-forward machine-learning predictions.

---

## 🌟 Key Platform Capabilities

1. **18-Layer Interactive GIS Engine:**
   High-performance WebGL map powered by MapLibre GL JS, featuring layer switching across meteorological, agricultural, hydrological, and environmental domains, administrative division filtering, and district detail drawers.
2. **Standardized Multi-Tier Drought Indices:**
   Mathematically rigorous Gamma MLE-fitted SPI (1m, 3m, 6m), Log-logistic SPEI, MODIS VCI (Vegetation Condition), TCI (Temperature Condition), VHI (Vegetation Health), and SMAP SSMI (Standardized Soil Moisture Index).
3. **Sub-Seasonal & Seasonal Machine Learning Forecasting:**
   Walk-forward chronological rolling-origin cross-validation (zero future data leakage) predicting drought onset probabilities at 30-day, 3-month, and 6-month horizons via XGBoost, LightGBM, and Random Forest.
4. **Local Feature Explainability (TreeSHAP):**
   Real-time local additive feature attributions for every prediction, showing positive and negative moisture drivers.
5. **NWP Forecast Protection:**
   Short-range 7-day and 15-day weather forecasts are strictly disabled with clear scientific disclosures until live numerical weather prediction (NWP) model feeds are integrated.
6. **Trilingual Early Warning Bulletins:**
   Automated threshold-based agricultural advisories available in English, Marathi (मराठी), and Hindi (हिन्दी).
7. **Farmer Ground-Truthing Portal (शेतकरी मंच):**
   Crowdsourced field report submission allowing registered farmers to report crop wilting, dry spells, and well levels to calibrate satellite indicators.
8. **Role-Based Portals:**
   Dedicated workflows for Farmers (`/farmer`), Researchers (`/researcher`), and System Administrators (`/admin`).

---

## 🏛️ System Architecture

```text
                                  +-----------------------------+
                                  |     Google Earth Engine     |
                                  |    (11 Satellite Sensors)   |
                                  +--------------+--------------+
                                                 |
                                                 v
+------------------------+        +--------------+--------------+        +------------------------+
|      Celery Beat       |------->|   Celery Workers (Prefetch 1) |<------>|      Redis 7 Broker    |
| (Cadence Ingestion)    |        | (Chunked 6-District Batches)|        | (Distributed Mutex)    |
+------------------------+        +--------------+--------------+        +------------------------+
                                                 |
                                                 v
                                  +--------------+--------------+
                                  |     PostgreSQL 16 / PostGIS |
                                  |  (36 MultiPolygon Districts)|
                                  +--------------+--------------+
                                                 ^
                                                 | SQLAlchemy / Psycopg3
                                                 v
                                  +--------------+--------------+
                                  |       FastAPI Backend       |
                                  |  (REST APIs, Argon2id, JWT) |
                                  +--------------+--------------+
                                                 ^
                                                 | JSON / GeoJSON
                                                 v
                                  +--------------+--------------+
                                  |   Next.js 16 Web Frontend   |
                                  |  (MapLibre GL, Recharts)    |
                                  +-----------------------------+
```

---

## 🚀 Quick Start (Local Development on Windows)

### 1. Backend Setup
```powershell
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install pinned dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run all automated tests
pytest tests -v

# Start FastAPI Development Server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup
In a second terminal:
```powershell
# Navigate to frontend
cd frontend

# Install clean lockfile dependencies
npm ci

# Verify quality gates
npm run typecheck
npm run lint

# Start Next.js Development Server
npm run dev
```
Web Application: `http://localhost:3000`

---

## 🐳 Production Deployment (Docker Compose)

Launch the full 6-service production stack:
```bash
# Clone repository
git clone https://github.com/organization/mdis.git /opt/mdis
cd /opt/mdis

# Copy environment variables
cp .env.example .env

# Build and start services in background
docker compose up -d --build

# Verify healthy service status
docker compose ps
```

The Docker Compose stack manages:
- `mdis-postgres`: PostGIS 16-3.4 database.
- `mdis-redis`: Redis 7-alpine message broker.
- `mdis-api`: FastAPI backend with 4 Uvicorn workers.
- `mdis-celery-worker`: 4-worker Celery background ingestion worker.
- `mdis-celery-beat`: Periodic scheduler triggering satellite ingestion.
- `mdis-frontend`: Standalone Next.js 16 container.

---

## 🧪 Test Suite & Quality Verification

- **Backend Pytest Suite:** **39 of 39 passed** (100% pass rate).
- **Frontend Typecheck:** **0 errors** (`npm run typecheck`).
- **Frontend ESLint:** **0 errors, 0 warnings** (`npm run lint`).
- **Next.js Production Build:** **21 of 21 routes successfully compiled and rendered** (`npm run build`).

---

## 📚 Technical Documentation

Detailed scientific and engineering reports are available in `/docs`:
- [System Architecture](docs/ARCHITECTURE.md)
- [Complete Engineering Audit](docs/FINAL_MASTER_AUDIT.md)
- [Final Acceptance Report](docs/FINAL_ACCEPTANCE_REPORT.md)
- [Drought Calculation Methodology](docs/DROUGHT_METHODOLOGY.md)
- [Machine Learning Methodology](docs/ML_METHODOLOGY.md)
- [Model Evaluation & Benchmarks](docs/MODEL_EVALUATION.md)
- [Data Dictionary & PostGIS Schema](docs/DATA_DICTIONARY.md)
- [Satellite Sensor Catalog (11 Missions)](docs/DATA_SOURCES.md)
- [REST API Documentation](docs/API_DOCUMENTATION.md)
- [Security Architecture](docs/SECURITY.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Backup & Disaster Recovery](docs/BACKUP_AND_RESTORE.md)
- [Frontend Design System](frontend/DESIGN_SYSTEM.md)
- [Frontend QA Report](docs/FRONTEND_QA_REPORT.md)

---

## 📜 License
Government of Maharashtra & Research Collaborators © 2024–2026. All rights reserved.

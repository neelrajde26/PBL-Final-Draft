# MDIS Local Development & Production Deployment Guide
## Maharashtra Drought Intelligence System

This document provides exact, reproducible startup procedures for local development on Windows and production deployment using Docker Compose.

---

### 1. Local Development (Windows PowerShell)

#### Prerequisites
- Python 3.11 installed.
- Node.js 20+ and npm installed.
- Google Earth Engine authenticated locally via ADC:
  ```powershell
  earthengine authenticate
  ```

#### 1.1 Backend Setup & Execution
Open a PowerShell terminal in the repository root:
```powershell
# 1. Navigate to backend
cd D:\Pbl-Final\backend

# 2. Activate Python virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Ensure environment variables are loaded
# backend\.env configured with GEE_PROJECT_ID=gee-pbl

# 4. Run database migrations and seed scripts (if PostGIS is running)
python -m seeds.seed_chirps_beed

# 5. Start FastAPI Backend with auto-reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API is available at: `http://127.0.0.1:8000` (Docs at `http://127.0.0.1:8000/docs`).

#### 1.2 Frontend Setup & Execution
Open a second PowerShell terminal in the repository root:
```powershell
# 1. Navigate to frontend
cd D:\Pbl-Final\frontend

# 2. Clean install dependencies (if not already installed)
npm ci

# 3. Launch Next.js Development Server
npm run dev
```
Web application is accessible at: `http://localhost:3000`.

---

### 2. Single-Command Production Deployment (Docker Compose)

For production Linux servers or Docker Desktop:

```bash
# 1. Clone repository and navigate to root
cd /opt/mdis

# 2. Verify environment configuration
cp .env.example .env
# Set secure JWT_SECRET and database passwords in .env

# 3. Build and launch all container services in background
docker compose up -d --build

# 4. Verify running health status of all 6 services
docker compose ps
```

The production topology launches:
1. `mdis-postgres`: PostGIS 16-3.4 database on port 5432.
2. `mdis-redis`: Redis 7-alpine message broker on port 6379.
3. `mdis-api`: FastAPI backend with 4 Uvicorn workers on port 8000.
4. `mdis-celery-worker`: 4-concurrency Celery task worker for background satellite ingestion.
5. `mdis-celery-beat`: Periodic scheduler triggering daily and composite ingestion.
6. `mdis-frontend`: Optimized standalone Next.js 16 container on port 3000.

#### 5. Verify Container Health
```bash
# Check API health
curl -f http://localhost:8000/api/ready

# Check Web Frontend
curl -f http://localhost:3000/
```


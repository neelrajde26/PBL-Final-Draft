# MDIS Database Architecture & PostGIS Guide
## Maharashtra Drought Intelligence System

This document details the database engine, geospatial extensions, spatial indexing, migration procedures, and schema verification for MDIS.

---

### 1. Engine & Extensions
- **RDBMS:** PostgreSQL 16
- **Spatial Extension:** PostGIS 3.4 (`CREATE EXTENSION IF NOT EXISTS postgis;`)
- **Driver:** `psycopg` (v3) with native connection pooling and binary PostGIS geometry encoding.
- **ORM / Query Layer:** SQLAlchemy 2.0 with GeoAlchemy2 for spatial types (`Geometry(MultiPolygon, 4326)`).

---

### 2. Spatial Indexing Strategy

Geospatial queries over high-precision MultiPolygons require R-Tree indexing to avoid expensive sequential table scans:

```sql
-- Spatial R-Tree Index on district boundaries
CREATE INDEX IF NOT EXISTS idx_district_boundaries_geom 
ON district_boundaries USING GIST (geometry);

-- Spatial Index on district centroids
CREATE INDEX IF NOT EXISTS idx_districts_centroid 
ON districts USING GIST (centroid);

-- Compound Index for fast temporal series lookups
CREATE INDEX IF NOT EXISTS idx_env_obs_district_time_var 
ON environmental_observations (district_id, variable_key, observation_time DESC);

-- Compound Index for drought indices lookups
CREATE INDEX IF NOT EXISTS idx_drought_indices_lookup 
ON drought_indices (district_id, index_key, observation_date DESC);
```

---

### 3. Migrations & Seed Execution

#### 3.1 Initializing Database Migrations
Migrations are managed via the versioned SQL scripts in `backend/migrations/`:
```bash
# Apply schema migrations
python -m app.db.migrate
```

#### 3.2 Seeding District Registry & Boundaries
The seed pipeline populates all 36 administrative districts and imports verified boundary MultiPolygons:
```bash
# Seed 36 district registry entries
python -m seeds.seed_districts

# Import Survey of India / PostGIS MultiPolygons
python -m seeds.seed_boundaries

# Seed verified CHIRPS Beed validation records (01–03 June 2024)
python -m seeds.seed_chirps_beed
```

---

### 4. Verification Queries

Verify that all 36 districts have active MultiPolygon boundaries:
```sql
SELECT d.id, d.name, d.region, d.code, 
       ST_GeometryType(b.geometry) AS geom_type,
       ST_Area(b.geometry::geography) / 1e6 AS area_sq_km,
       ST_AsText(d.centroid) AS centroid_wkt
FROM districts d
LEFT JOIN district_boundaries b ON b.district_id = d.id
ORDER BY d.name;
```
Expected output: Exactly 36 rows, all with `geom_type = 'ST_MultiPolygon'`.


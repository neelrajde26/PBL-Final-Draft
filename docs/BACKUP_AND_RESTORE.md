# MDIS Backup, Disaster Recovery & Restoration Guide
## Maharashtra Drought Intelligence System

This document outlines the backup protocols, PostGIS geometry dump procedures, and point-in-time disaster recovery plans for MDIS.

---

### 1. Backup Strategy Overview

MDIS manages three categories of persistent data:
1. **Administrative & Relational Data:** District registry, user accounts, farmer ground-truthing reports, and alerts.
2. **Spatial MultiPolygons:** PostGIS geometric boundary features for all 36 districts.
3. **Time-Series Satellite Reductions:** Ingested raster zonal statistics and computed drought indices.

---

### 2. Automated PostgreSQL / PostGIS Backup

#### 2.1 Full Custom-Format Backup (`pg_dump -Fc`)
The custom compressed format preserves spatial tables, constraints, and indexes with parallel restore capabilities:

```bash
# Execute compressed binary dump
docker exec -t mdis-postgres pg_dump \
  -U mdis \
  -d mdis \
  -Fc \
  --exclude-table=spatial_ref_sys \
  -f /data/backups/mdis_backup_$(date +%Y%m%d_%H%M%S).dump
```

*Note:* `--exclude-table=spatial_ref_sys` prevents conflicts with the default PostGIS extension spatial coordinate system table during restoration.

#### 2.2 Plain SQL Backup for Schema Auditing
```bash
docker exec -t mdis-postgres pg_dump \
  -U mdis \
  -d mdis \
  --schema-only \
  -f /data/backups/mdis_schema_$(date +%Y%m%d).sql
```

---

### 3. Restoration Procedure

In the event of database failure or hardware migration:

```bash
# 1. Ensure target PostGIS container is healthy
docker compose up -d postgres

# 2. Terminate existing client connections to mdis database
docker exec -i mdis-postgres psql -U mdis -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'mdis' AND pid <> pg_backend_pid();"

# 3. Drop and recreate database
docker exec -i mdis-postgres psql -U mdis -c "DROP DATABASE IF EXISTS mdis;"
docker exec -i mdis-postgres psql -U mdis -c "CREATE DATABASE mdis OWNER mdis;"
docker exec -i mdis-postgres psql -U mdis -d mdis -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 4. Restore database from compressed dump using pg_restore
docker exec -i mdis-postgres pg_restore \
  -U mdis \
  -d mdis \
  --clean \
  --if-exists \
  --no-owner \
  /data/backups/mdis_backup_2024xxxx.dump

# 5. Verify integrity of spatial MultiPolygons
docker exec -i mdis-postgres psql -U mdis -d mdis -c "
SELECT count(*) AS total_districts, 
       sum(CASE WHEN geometry IS NOT NULL THEN 1 ELSE 0 END) AS valid_boundaries 
FROM district_boundaries;"
```
Expected output: Exactly 36 total districts and 36 valid boundaries.


# MDIS REST API Specification
## Maharashtra Drought Intelligence System

All endpoints are hosted under the base path `/api`. All request and response bodies use standard JSON formatting unless a binary or GeoJSON media type is specified.

---

### 1. System Health & Readiness

#### `GET /api/live`
- **Description:** Basic liveness probe for Kubernetes and Docker container healthchecks.
- **Auth:** None.
- **Response:** `200 OK`
```json
{ "status": "alive" }
```

#### `GET /api/ready`
- **Description:** Readiness probe checking database connectivity and Google Earth Engine credentials.
- **Auth:** None.
- **Response:** `200 OK`
```json
{
  "status": "ready",
  "database": { "configured": true, "available": true, "message": "PostGIS connected" },
  "gee": { "configured": true, "available": true, "project_id": "gee-pbl", "auth_method": "ADC" }
}
```

---

### 2. Authentication & Authorization

#### `POST /api/auth/register`
- **Description:** Register a new farmer user account. Public registration strictly defaults to role `FARMER`.
- **Request Body:**
```json
{
  "email": "farmer@example.com",
  "password": "Password123!",
  "full_name": "Ramesh Kadam",
  "district_id": "beed",
  "taluka": "Georai",
  "village": "Madalmohi",
  "preferred_language": "mr"
}
```
- **Response:** `201 Created` with HttpOnly `mdis_session` JWT cookie.

#### `POST /api/auth/login`
- **Description:** Authenticate user and issue secure session cookie.
- **Request Body:**
```json
{
  "email": "farmer@example.com",
  "password": "Password123!"
}
```

#### `GET /api/auth/me`
- **Description:** Retrieve current authenticated user profile and active role.
- **Auth:** Session Cookie / Bearer Token.

---

### 3. Administrative Geometry & Districts

#### `GET /api/districts`
- **Description:** Retrieve all 36 administrative districts with boundary availability and centroids.
- **Response:** `200 OK`
```json
{
  "count": 36,
  "items": [
    {
      "id": "beed",
      "code": "MH-BD",
      "name": "Beed",
      "region": "Marathwada",
      "is_priority": true,
      "boundary_available": true,
      "boundary_version": "2024.1",
      "centroid": { "longitude": 75.75, "latitude": 18.99 }
    }
  ]
}
```

#### `GET /api/districts/boundaries`
- **Description:** GeoJSON FeatureCollection containing versioned PostGIS MultiPolygons for all districts.
- **Response:** `200 OK` (`application/geo+json`)

---

### 4. Interactive Maps & Geospatial Layers

#### `GET /api/maps/layers`
- **Description:** Catalog of the 18 geospatial raster layers (meteorological, agricultural, hydrological, environmental).
- **Response:** `200 OK`

#### `GET /api/maps/district-indicators?indicator={indicator}&region={region}`
- **Description:** GeoJSON FeatureCollection joining district polygons with the latest measured indicator value for thematic choropleth rendering.

---

### 5. Satellite Earth Observation Data

#### `GET /api/satellite/district/{district_id}?variable=rainfall&start={iso}&end={iso}`
- **Description:** Retrieve stored spatial reduction observations for a district.
- **Query Parameters:**
  - `variable`: `rainfall`, `ndvi`, `evi`, `lst_day`, `soil_moisture`.
  - `start`: ISO 8601 start timestamp.
  - `end`: ISO 8601 end timestamp.
- **Response:** `200 OK`

---

### 6. Drought Indices & Events

#### `GET /api/drought/indices?domain={domain}&district_id={id}`
- **Description:** Query computed SPI, SPEI, VCI, VHI, or SSMI indices.

#### `GET /api/drought/district/{district_id}`
- **Description:** Detailed multi-index time-series profile for a single district.

#### `GET /api/drought/events?district_id={id}&severity={severity}`
- **Description:** Characterized historical drought events based on Yevjevich run theory.

---

### 7. Predictions & Forecasting

#### `GET /api/predictions?district_id={id}&horizon={horizon}`
- **Description:** Operational sub-seasonal and seasonal forecast probabilities.
- **Query Parameters:**
  - `horizon`: `30d`, `3m`, `6m`. (Note: `7d` and `15d` return `supported: false` with explanation).

#### `POST /api/predictions/run`
- **Description:** Trigger an asynchronous prediction run.
- **Auth:** Restricted to `ADMIN` and `RESEARCHER` roles.

---

### 8. Early Warning & Farmer Ground-Truthing

#### `GET /api/alerts?district_id={id}&warning_level={level}&language={en|mr|hi}`
- **Description:** Active early warning notifications with multilingual agricultural advisories.

#### `GET /api/farmer/reports?district_id={id}&status={status}`
- **Description:** Crowdsourced ground-truth field reports from farmers.

#### `POST /api/farmer/reports`
- **Description:** Submit a field observation to ground-truth satellite indicators.
- **Request Body:**
```json
{
  "district_id": "beed",
  "crop": "Cotton",
  "concern": "Extended dry spell",
  "description": "No rain for 18 days; leaves wilting under afternoon heat."
}
```

---

### 9. Administration & Orchestration

#### `GET /api/admin/system`
- **Description:** System health telemetry and worker status.
- **Auth:** Restricted to `ADMIN` role.

#### `GET /api/admin/users`
- **Description:** Registered user account management.
- **Auth:** Restricted to `ADMIN` role.

#### `POST /api/admin/users/{user_id}/status`
- **Description:** Activate or deactivate a user account.
- **Auth:** Restricted to `ADMIN` role.


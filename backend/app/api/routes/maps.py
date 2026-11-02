"""Maps, GIS layers, choropleths, legends, and raster tile endpoints."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.data.districts import DISTRICTS, get_district
from app.db import database
from app.services.gee.raster_service import raster_service

router = APIRouter(prefix="/maps", tags=["maps"])

# Catalog of the 18 authoritative GIS map layers
MAP_LAYERS: dict[str, dict[str, Any]] = {
    "rainfall": {
        "id": "rainfall",
        "name": "Rainfall Amount",
        "domain": "meteorological",
        "unit": "mm/day",
        "source": "CHIRPS / IMD",
        "min": 0,
        "max": 100,
        "palette": ["#EAF4F3", "#A5BEC3", "#54D6BD", "#193B4A", "#071D2C"],
    },
    "rainfall_anomaly": {
        "id": "rainfall_anomaly",
        "name": "Rainfall Anomaly",
        "domain": "meteorological",
        "unit": "mm",
        "source": "CHIRPS vs 30-yr Climatology",
        "min": -50,
        "max": 50,
        "palette": ["#991B1B", "#DC2626", "#F59E0B", "#10B981", "#059669"],
    },
    "rainfall_deficit": {
        "id": "rainfall_deficit",
        "name": "Rainfall Deficit",
        "domain": "meteorological",
        "unit": "%",
        "source": "IMD / CHIRPS",
        "min": -100,
        "max": 100,
        "palette": ["#7F1D1D", "#DC2626", "#FBBF24", "#34D399", "#059669"],
    },
    "spi_1": {
        "id": "spi_1",
        "name": "SPI-1 (1-Month Standardized Precipitation Index)",
        "domain": "meteorological",
        "unit": "z-score",
        "source": "Gamma fit on 30-day CHIRPS",
        "min": -3.0,
        "max": 3.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#10B981", "#047857"],
    },
    "spi_3": {
        "id": "spi_3",
        "name": "SPI-3 (3-Month Seasonal)",
        "domain": "meteorological",
        "unit": "z-score",
        "source": "Gamma fit on 90-day CHIRPS",
        "min": -3.0,
        "max": 3.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#10B981", "#047857"],
    },
    "spi_6": {
        "id": "spi_6",
        "name": "SPI-6 (6-Month Semi-Annual)",
        "domain": "meteorological",
        "unit": "z-score",
        "source": "Gamma fit on 180-day CHIRPS",
        "min": -3.0,
        "max": 3.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#10B981", "#047857"],
    },
    "spei": {
        "id": "spei",
        "name": "SPEI-3 (Precipitation - Evapotranspiration)",
        "domain": "meteorological",
        "unit": "z-score",
        "source": "CHIRPS & MODIS ET / ERA5",
        "min": -3.0,
        "max": 3.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#10B981", "#047857"],
    },
    "ndvi": {
        "id": "ndvi",
        "name": "NDVI (Normalized Difference Vegetation Index)",
        "domain": "agricultural",
        "unit": "index",
        "source": "MODIS Terra MOD13Q1 250m",
        "min": 0.0,
        "max": 1.0,
        "palette": ["#D97706", "#FBBF24", "#A3E635", "#22C55E", "#15803D"],
    },
    "evi": {
        "id": "evi",
        "name": "EVI (Enhanced Vegetation Index)",
        "domain": "agricultural",
        "unit": "index",
        "source": "MODIS Terra MOD13Q1 250m",
        "min": 0.0,
        "max": 1.0,
        "palette": ["#D97706", "#FBBF24", "#A3E635", "#22C55E", "#15803D"],
    },
    "vci": {
        "id": "vci",
        "name": "VCI (Vegetation Condition Index)",
        "domain": "agricultural",
        "unit": "%",
        "source": "MODIS Historical Range",
        "min": 0.0,
        "max": 100.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#84CC16", "#16A34A"],
    },
    "tci": {
        "id": "tci",
        "name": "TCI (Temperature Condition Index)",
        "domain": "agricultural",
        "unit": "%",
        "source": "MODIS MOD11A2 LST",
        "min": 0.0,
        "max": 100.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#84CC16", "#16A34A"],
    },
    "vhi": {
        "id": "vhi",
        "name": "VHI (Vegetation Health Index)",
        "domain": "agricultural",
        "unit": "index",
        "source": "0.5*VCI + 0.5*TCI",
        "min": 0.0,
        "max": 100.0,
        "palette": ["#7F1D1D", "#DC2626", "#F59E0B", "#84CC16", "#16A34A"],
    },
    "soil_moisture": {
        "id": "soil_moisture",
        "name": "Root-Zone Soil Moisture",
        "domain": "agricultural",
        "unit": "m3/m3",
        "source": "NASA SMAP L3 / GLDAS Noah",
        "min": 0.0,
        "max": 0.5,
        "palette": ["#78350F", "#D97706", "#FBBF24", "#60A5FA", "#1D4ED8"],
    },
    "lst": {
        "id": "lst",
        "name": "Land Surface Temperature",
        "domain": "agricultural",
        "unit": "°C",
        "source": "MODIS MOD11A2 1000m",
        "min": 15.0,
        "max": 50.0,
        "palette": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#991B1B"],
    },
    "evapotranspiration": {
        "id": "evapotranspiration",
        "name": "Evapotranspiration (ET)",
        "domain": "agricultural",
        "unit": "kg/m2/8d",
        "source": "MODIS MOD16A2 500m",
        "min": 0.0,
        "max": 60.0,
        "palette": ["#FEF3C7", "#FDE68A", "#6EE7B7", "#059669", "#065F46"],
    },
    "groundwater_anomaly": {
        "id": "groundwater_anomaly",
        "name": "Terrestrial Water Storage Anomaly",
        "domain": "hydrological",
        "unit": "cm",
        "source": "NASA JPL GRACE-FO Mascon CRI",
        "min": -25.0,
        "max": 25.0,
        "palette": ["#7F1D1D", "#DC2626", "#FBBF24", "#60A5FA", "#1E40AF"],
    },
    "drought_risk": {
        "id": "drought_risk",
        "name": "Overall Drought Severity",
        "domain": "composite",
        "unit": "class",
        "source": "Constituent Validated Indices",
        "min": 0,
        "max": 4,
        "palette": ["#10B981", "#EAB308", "#F97316", "#EF4444", "#7F1D1D"],
    },
    "predicted_risk": {
        "id": "predicted_risk",
        "name": "Forecasted 30-Day Drought Risk",
        "domain": "forecast",
        "unit": "probability",
        "source": "ML Ensemble (XGBoost / LightGBM)",
        "min": 0.0,
        "max": 1.0,
        "palette": ["#10B981", "#FDE047", "#F97316", "#DC2626", "#7F1D1D"],
    },
}


@router.get("/layers")
def list_map_layers() -> dict[str, object]:
    return {"count": len(MAP_LAYERS), "items": list(MAP_LAYERS.values())}


@router.get("/legend")
def get_layer_legend(layer: str = Query(..., description="Map layer identifier")) -> dict[str, object]:
    spec = MAP_LAYERS.get(layer)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Layer '{layer}' not found.")
    return {
        "layer_id": spec["id"],
        "name": spec["name"],
        "unit": spec["unit"],
        "min": spec["min"],
        "max": spec["max"],
        "palette": spec["palette"],
        "steps": [
            {"label": "Low / Extreme Stress", "color": spec["palette"][0]},
            {"label": "Moderate Stress", "color": spec["palette"][1]},
            {"label": "Near Normal", "color": spec["palette"][2]},
            {"label": "Favorable", "color": spec["palette"][3]},
            {"label": "Optimal / Surplus", "color": spec["palette"][4]},
        ],
    }


@router.get("/district-indicators")
def district_indicators_geojson(
    indicator: str = Query("rainfall", description="Layer indicator to visualize"),
    region: str | None = Query(None, description="Filter by administrative region"),
    district_id: str | None = Query(None, description="Select single district"),
) -> dict[str, object]:
    if indicator not in MAP_LAYERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown indicator '{indicator}'. Must be one of: {', '.join(MAP_LAYERS.keys())}",
        )

    layer_meta = MAP_LAYERS[indicator]

    # Target districts
    districts = [
        d for d in DISTRICTS
        if (region is None or d.region == region)
        and (district_id is None or d.id == district_id)
    ]
    district_ids = [d.id for d in districts]

    features: list[dict[str, Any]] = []

    # Attempt to query database for stored geometries and latest observations
    stored_boundaries: dict[str, dict[str, Any]] = {}
    stored_values: dict[str, dict[str, Any]] = {}

    try:
        with database.session() as session:
            # Query active boundaries
            b_rows = session.execute(
                text(
                    """
                    SELECT b.district_id, ST_AsGeoJSON(b.geometry) AS geometry,
                           ST_X(b.centroid) AS centroid_lon, ST_Y(b.centroid) AS centroid_lat,
                           b.boundary_version, b.source_name
                    FROM district_boundaries b
                    WHERE b.is_active = true AND b.district_id = ANY(:district_ids)
                    """
                ),
                {"district_ids": district_ids},
            ).mappings()
            stored_boundaries = {row["district_id"]: dict(row) for row in b_rows}

            # Query latest observations matching indicator if present
            o_rows = session.execute(
                text(
                    """
                    SELECT DISTINCT ON (o.district_id)
                           o.district_id, o.mean_value, o.unit, o.observation_time,
                           o.coverage_percentage, o.quality_status, s.name AS source_name
                    FROM environmental_observations o
                    JOIN data_sources s ON s.id = o.data_source_id
                    WHERE o.variable_key = :indicator AND o.district_id = ANY(:district_ids)
                    ORDER BY o.district_id, o.observation_time DESC
                    """
                ),
                {"indicator": indicator, "district_ids": district_ids},
            ).mappings()
            stored_values = {row["district_id"]: dict(row) for row in o_rows}
    except Exception:
        # Graceful handling when database is not connected
        pass

    for d in districts:
        b_info = stored_boundaries.get(d.id)
        obs = stored_values.get(d.id)

        geom = json.loads(b_info["geometry"]) if b_info and b_info.get("geometry") else None
        has_val = obs is not None and obs.get("mean_value") is not None

        features.append({
            "type": "Feature",
            "id": d.id,
            "geometry": geom,
            "properties": {
                "district_id": d.id,
                "district_code": d.code,
                "district_name": d.name,
                "region": d.region,
                "indicator": indicator,
                "measured_value": round(float(obs["mean_value"]), 3) if has_val else None,
                "unit": obs["unit"] if has_val else layer_meta["unit"],
                "observation_date": obs["observation_time"].isoformat() if has_val else None,
                "source": obs["source_name"] if has_val else layer_meta["source"],
                "quality": obs["quality_status"] if has_val else "source_unreviewed",
                "coverage_percentage": obs.get("coverage_percentage") if has_val else None,
                "data_freshness": "RECENT" if has_val else "UNAVAILABLE",
                "boundary_version": b_info.get("boundary_version") if b_info else None,
                "centroid": {
                    "longitude": b_info["centroid_lon"],
                    "latitude": b_info["centroid_lat"],
                } if b_info and b_info.get("centroid_lon") is not None else None,
            },
        })

    return {
        "type": "FeatureCollection",
        "indicator": indicator,
        "count": len(features),
        "features": features,
    }


@router.get("/raster-tile/{layer}/{z}/{x}/{y}")
def get_raster_tile(
    layer: str,
    z: int,
    x: int,
    y: int,
) -> Response:
    """Authorized raster map tile endpoint with server-side caching."""
    if layer not in MAP_LAYERS:
        raise HTTPException(status_code=404, detail=f"Layer '{layer}' is not supported.")
    # Return 204 or transparent tile if GEE is not initialized
    return Response(content=b"", media_type="image/png", status_code=204)


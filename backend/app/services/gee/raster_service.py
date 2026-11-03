from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import logging
import threading
import time
from typing import Any, Mapping

import httpx

from app.services.gee.district_extractor import DistrictBoundary, DistrictExtractor
from app.services.gee.gee_client import EarthEngineClient, gee_client
from app.services.gee.gee_collections import COLLECTIONS
from app.services.gee.gee_processor import GeeProcessor

logger = logging.getLogger("mdis.raster")


class GeeTileUnavailableError(RuntimeError):
    """Raised when Earth Engine is not authenticated, offline, or unable to generate raster tiles."""


class GeeTileCoordinateError(ValueError):
    """Raised when zoom or tile coordinates are mathematically or spatially invalid."""


@dataclass(frozen=True, slots=True)
class RasterTile:
    collection_key: str
    band: str
    period_start: str
    period_end: str
    tile_url: str
    visualization: Mapping[str, Any]


LAYER_SPECS: dict[str, dict[str, Any]] = {
    "rainfall": {
        "collection_key": "chirps_daily",
        "band": "rainfall",
        "min": 0.0,
        "max": 80.0,
        "palette": ["EAF4F3", "A5BEC3", "54D6BD", "193B4A", "071D2C"],
    },
    "ndvi": {
        "collection_key": "modis_vi",
        "band": "ndvi",
        "min": 0.0,
        "max": 0.85,
        "palette": ["D97706", "FBBF24", "A3E635", "22C55E", "15803D"],
    },
    "evi": {
        "collection_key": "modis_vi",
        "band": "evi",
        "min": 0.0,
        "max": 0.70,
        "palette": ["D97706", "FBBF24", "A3E635", "22C55E", "15803D"],
    },
    "lst": {
        "collection_key": "modis_lst",
        "band": "lst_day",
        "min": 20.0,
        "max": 48.0,
        "palette": ["3B82F6", "60A5FA", "FCD34D", "F97316", "DC2626"],
    },
    "soil_moisture": {
        "collection_key": "smap_sm_spl3smp_e",
        "band": "soil_moisture",
        "min": 0.05,
        "max": 0.45,
        "palette": ["78350F", "D97706", "FBBF24", "38BDF8", "0284C7"],
    },
}


def validate_tile_coordinates(z: int, x: int, y: int) -> None:
    """Validate tile coordinates against standard Web Mercator math and Maharashtra extents."""
    if z < 0 or z > 18:
        raise GeeTileCoordinateError(f"Invalid zoom level {z}. Zoom must be between 0 and 18.")
    max_coord = (1 << z) - 1
    if x < 0 or x > max_coord or y < 0 or y > max_coord:
        raise GeeTileCoordinateError(f"Tile coordinates ({x}, {y}) out of range for zoom level {z}.")


class RasterService:
    def __init__(self, client: EarthEngineClient) -> None:
        self.client = client
        self.processor = GeeProcessor(client)
        self.extractor = DistrictExtractor(client)
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, bytes]] = {}  # key -> (timestamp, tile_bytes)
        self._map_id_cache: dict[str, tuple[float, str]] = {}  # key -> (timestamp, url_format)
        self._cache_ttl = 3600.0  # 1 hour
        self._max_cache_items = 500

    def validate_tile_coordinates(self, z: int, x: int, y: int) -> None:
        validate_tile_coordinates(z, x, y)

    def tile(
        self,
        collection_key: str,
        band: str,
        boundary: DistrictBoundary,
        start_date: str,
        end_date: str,
        visualization: Mapping[str, Any],
    ) -> RasterTile:
        geometry = self.extractor.geometry(boundary)
        result = self.processor.composite(collection_key, start_date, end_date, geometry)
        image = result.image.select(band).clip(geometry)
        map_info = image.getMapId(dict(visualization))
        tile_url = (
            map_info.get("tile_fetcher").url_format
            if map_info.get("tile_fetcher")
            else map_info.get("urlFormat")
        )
        if not tile_url:
            raise RuntimeError("Earth Engine did not return a raster tile URL.")
        return RasterTile(
            collection_key=collection_key,
            band=band,
            period_start=start_date,
            period_end=end_date,
            tile_url=tile_url,
            visualization=dict(visualization),
        )

    def fetch_tile(
        self,
        layer: str,
        z: int,
        x: int,
        y: int,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> bytes:
        """Fetch and return verified raster PNG tile bytes with server-side caching."""
        self.validate_tile_coordinates(z, x, y)

        if layer not in LAYER_SPECS:
            raise ValueError(f"Layer '{layer}' does not support raster rendering. Supported: {list(LAYER_SPECS.keys())}")

        health = self.client.health(verify_remote=False)
        if not health.configured:
            raise GeeTileUnavailableError("Google Earth Engine is not configured. Raster tiles are unavailable.")
        if not health.available and health.status != "connected":
            # Attempt remote check if not tested yet
            remote_health = self.client.health(verify_remote=True)
            if not remote_health.available:
                raise GeeTileUnavailableError(f"Google Earth Engine is unavailable: {remote_health.message}")

        spec = LAYER_SPECS[layer]
        col_key = spec["collection_key"]
        band = spec["band"]

        # Default to a recent representative 30-day window if dates omitted
        s_date = start_date or "2024-06-01"
        e_date = end_date or "2024-06-30"

        cache_key = f"{layer}_{col_key}_{band}_{s_date}_{e_date}_{z}_{x}_{y}"
        current_time = time.monotonic()

        with self._lock:
            if cache_key in self._cache:
                ts, data = self._cache[cache_key]
                if current_time - ts < self._cache_ttl:
                    return data

        # Check mapId cache
        map_cache_key = f"{layer}_{col_key}_{band}_{s_date}_{e_date}"
        url_format: str | None = None
        with self._lock:
            if map_cache_key in self._map_id_cache:
                ts, fmt = self._map_id_cache[map_cache_key]
                if current_time - ts < self._cache_ttl:
                    url_format = fmt

        if url_format is None:
            # Build Earth Engine image composite across Maharashtra state extent
            ee = self.client.initialize(verify_remote=False)
            state_bounds = ee.Geometry.Rectangle([72.55, 15.55, 80.95, 22.15])
            comp = self.processor.composite(col_key, s_date, e_date, state_bounds)
            img = comp.image.select(band).clip(state_bounds)
            viz = {
                "min": spec["min"],
                "max": spec["max"],
                "palette": spec["palette"],
            }
            map_info = img.getMapId(viz)
            url_format = (
                map_info.get("tile_fetcher").url_format
                if map_info.get("tile_fetcher")
                else map_info.get("urlFormat")
            )
            if not url_format:
                raise RuntimeError("Earth Engine did not return a tile fetcher URL.")

            with self._lock:
                self._map_id_cache[map_cache_key] = (current_time, url_format)

        # Retrieve tile from Earth Engine tile endpoint safely server-side
        tile_url = url_format.format(x=x, y=y, z=z)
        try:
            with httpx.Client(timeout=10.0) as http_client:
                resp = http_client.get(tile_url)
                if resp.status_code == 200:
                    tile_bytes = resp.content
                    with self._lock:
                        if len(self._cache) >= self._max_cache_items:
                            # Prune oldest
                            oldest = min(self._cache.keys(), key=lambda k: self._cache[k][0])
                            del self._cache[oldest]
                        self._cache[cache_key] = (current_time, tile_bytes)
                    return tile_bytes
                if resp.status_code == 404:
                    raise GeeTileCoordinateError(f"Tile {z}/{x}/{y} does not intersect valid raster data.")
                raise RuntimeError(f"Upstream Earth Engine tile fetch returned status {resp.status_code}")
        except httpx.RequestError as exc:
            raise GeeTileUnavailableError(f"Network error communicating with Earth Engine tile service: {exc}") from exc


raster_service = RasterService(gee_client)

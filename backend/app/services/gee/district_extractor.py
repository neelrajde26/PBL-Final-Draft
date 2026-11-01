from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_processor import CompositeResult, GeeProcessor


class InvalidDistrictBoundary(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class DistrictBoundary:
    district_id: str
    district_code: str
    name: str
    geometry: Mapping[str, Any]
    boundary_version: str
    source: str


def validate_polygon_geometry(geometry: Mapping[str, Any]) -> None:
    geometry_type = geometry.get("type")
    if geometry_type not in {"Polygon", "MultiPolygon"}:
        raise InvalidDistrictBoundary(
            "District extraction requires a Polygon or MultiPolygon; points and buffers are forbidden."
        )
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, (list, tuple)) or not coordinates:
        raise InvalidDistrictBoundary("District boundary coordinates are missing.")


class DistrictExtractor:
    def __init__(self, client: EarthEngineClient) -> None:
        self.client = client
        self.processor = GeeProcessor(client)

    def geometry(self, boundary: DistrictBoundary) -> Any:
        validate_polygon_geometry(boundary.geometry)
        ee = self.client.initialize(verify_remote=False)
        return ee.Geometry(dict(boundary.geometry), proj="EPSG:4326", geodesic=True)

    def _feature_for_result(
        self,
        result: CompositeResult,
        boundary: DistrictBoundary,
        geometry: Any,
        start_date: str,
        end_date: str,
    ) -> Any:
        ee = self.client.initialize(verify_remote=False)
        reducer = (
            ee.Reducer.mean()
            .combine(ee.Reducer.median(), sharedInputs=True)
            .combine(ee.Reducer.minMax(), sharedInputs=True)
            .combine(ee.Reducer.count(), sharedInputs=True)
        )
        stats = result.image.reduceRegion(
            reducer=reducer,
            geometry=geometry,
            scale=result.spec.native_scale_m,
            bestEffort=False,
            maxPixels=100_000_000,
            tileScale=4,
        )
        total_pixels = ee.Number(
            ee.Image.constant(1)
            .rename("total")
            .reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=geometry,
                scale=result.spec.native_scale_m,
                bestEffort=False,
                maxPixels=100_000_000,
                tileScale=4,
            )
            .get("total")
        )
        properties: dict[str, Any] = {
            "district_id": boundary.district_id,
            "district_code": boundary.district_code,
            "district_name": boundary.name,
            "boundary_version": boundary.boundary_version,
            "boundary_source": boundary.source,
            "collection_key": result.spec.key,
            "collection_id": result.spec.collection_id,
            "period_start": start_date,
            "period_end": end_date,
            "native_temporal_resolution": result.spec.temporal_resolution.value,
            "native_scale_m": result.spec.native_scale_m,
            "image_count": result.image_count,
            "first_acquisition_ms": result.first_acquisition_ms,
            "last_acquisition_ms": result.last_acquisition_ms,
            "total_pixel_count": total_pixels,
        }
        output_bands = [item.output_band for item in result.spec.bands]
        if result.spec.key == "sentinel2_sr":
            output_bands.extend(["ndvi", "evi", "ndwi"])
        elif result.spec.key == "sentinel1_grd":
            output_bands.append("vv_vh_db")
        for band in output_bands:
            properties[f"{band}_mean"] = stats.get(f"{band}_mean")
            properties[f"{band}_median"] = stats.get(f"{band}_median")
            properties[f"{band}_min"] = stats.get(f"{band}_min")
            properties[f"{band}_max"] = stats.get(f"{band}_max")
            properties[f"{band}_valid_pixel_count"] = stats.get(f"{band}_count")
            properties[f"{band}_coverage_pct"] = ee.Algorithms.If(
                total_pixels.gt(0),
                ee.Number(stats.get(f"{band}_count")).divide(total_pixels).multiply(100),
                None,
            )
        return ee.Feature(geometry, properties)

    def extract_period(
        self,
        collection_key: str,
        boundary: DistrictBoundary,
        start_date: str,
        end_date: str,
    ) -> Any:
        geometry = self.geometry(boundary)
        result = self.processor.composite(collection_key, start_date, end_date, geometry)
        return self._feature_for_result(result, boundary, geometry, start_date, end_date)

    def extract_many(
        self,
        collection_key: str,
        boundaries: Iterable[DistrictBoundary],
        start_date: str,
        end_date: str,
    ) -> Any:
        """Build one server-side FeatureCollection for a district batch.

        No evaluation occurs here. A worker may evaluate/export the returned
        FeatureCollection once, avoiding one HTTP request per district.
        """

        ee = self.client.initialize(verify_remote=False)
        features = [
            self.extract_period(collection_key, boundary, start_date, end_date)
            for boundary in boundaries
        ]
        return ee.FeatureCollection(features)


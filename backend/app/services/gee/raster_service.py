from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from app.services.gee.district_extractor import DistrictBoundary, DistrictExtractor
from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_processor import GeeProcessor


@dataclass(frozen=True, slots=True)
class RasterTile:
    collection_key: str
    band: str
    period_start: str
    period_end: str
    tile_url: str
    visualization: Mapping[str, Any]


class RasterService:
    def __init__(self, client: EarthEngineClient) -> None:
        self.client = client
        self.processor = GeeProcessor(client)
        self.extractor = DistrictExtractor(client)

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
        tile_url = map_info.get("tile_fetcher").url_format if map_info.get("tile_fetcher") else map_info.get("urlFormat")
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


from app.services.gee.gee_client import gee_client

raster_service = RasterService(gee_client)


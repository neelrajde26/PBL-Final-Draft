from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.repositories import (
    EnvironmentalObservationRepository,
    EnvironmentalObservationWrite,
)
from app.services.gee.district_extractor import DistrictBoundary, DistrictExtractor
from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_collections import get_collection_spec


@dataclass(frozen=True, slots=True)
class NativeIngestionResult:
    collection_key: str
    district_id: str
    feature_count: int
    observation_count: int
    first_acquisition: str | None
    last_acquisition: str | None


class NativeIngestionService:
    """Persist small native-cadence chunks produced by Earth Engine.

    This synchronous path is intentionally bounded and is suitable for live
    diagnostics and incremental chunks. Historical backfills use background
    jobs and export-task monitoring rather than a single large ``getInfo()``.
    """

    def __init__(self, client: EarthEngineClient, session: Session) -> None:
        self.client = client
        self.session = session
        self.extractor = DistrictExtractor(client)

    def _boundary(self, district_id: str) -> tuple[DistrictBoundary, UUID]:
        row = self.session.execute(
            text(
                """
                SELECT d.id, d.code, d.name, b.id AS boundary_id,
                       b.boundary_version, b.source_name,
                       ST_AsGeoJSON(b.geometry) AS geometry
                FROM districts d
                JOIN district_boundaries b ON b.district_id = d.id AND b.is_active = true
                WHERE d.id = :district_id
                """
            ),
            {"district_id": district_id},
        ).mappings().one_or_none()
        if row is None:
            raise ValueError(f"No active stored boundary for district {district_id}.")
        return (
            DistrictBoundary(
                district_id=row["id"],
                district_code=row["code"],
                name=row["name"],
                geometry=json.loads(row["geometry"]),
                boundary_version=row["boundary_version"],
                source=row["source_name"],
            ),
            row["boundary_id"],
        )

    def run_small_chunk(
        self,
        collection_key: str,
        district_id: str,
        start_date: str,
        end_date: str,
        *,
        maximum_features: int = 100,
    ) -> NativeIngestionResult:
        spec = get_collection_spec(collection_key)
        boundary, boundary_id = self._boundary(district_id)
        source_id = self.session.execute(
            text("SELECT id FROM data_sources WHERE key = :key AND active = true"),
            {"key": collection_key},
        ).scalar_one()
        feature_collection = self.extractor.extract_native_series(
            collection_key,
            boundary,
            start_date,
            end_date,
        )
        payload: dict[str, Any] = feature_collection.getInfo()
        features: list[dict[str, Any]] = payload.get("features", [])
        if len(features) > maximum_features:
            raise ValueError(
                f"Synchronous ingestion returned {len(features)} features; limit is {maximum_features}."
            )

        writes: list[EnvironmentalObservationWrite] = []
        acquisitions: list[datetime] = []
        for feature in features:
            properties = feature["properties"]
            acquisition = datetime.fromtimestamp(
                properties["acquisition_time_ms"] / 1000,
                tz=UTC,
            )
            period_start = datetime.fromtimestamp(properties["period_start_ms"] / 1000, tz=UTC)
            period_end = datetime.fromtimestamp(properties["period_end_ms"] / 1000, tz=UTC)
            acquisitions.append(acquisition)
            for band in spec.bands:
                prefix = band.output_band
                writes.append(
                    EnvironmentalObservationWrite(
                        district_id=district_id,
                        data_source_id=source_id,
                        boundary_id=boundary_id,
                        variable_key=prefix,
                        observation_time=acquisition,
                        period_start=period_start,
                        period_end=period_end,
                        mean_value=properties.get(f"{prefix}_mean"),
                        median_value=properties.get(f"{prefix}_median"),
                        minimum_value=properties.get(f"{prefix}_min"),
                        maximum_value=properties.get(f"{prefix}_max"),
                        valid_pixel_count=properties.get(f"{prefix}_valid_pixel_count"),
                        total_pixel_count=properties.get(f"{prefix}_total_pixel_count"),
                        coverage_percentage=properties.get(f"{prefix}_coverage_pct"),
                        unit=band.unit,
                        quality_status="source_qa_applied",
                        processing_metadata={
                            "collection_id": spec.collection_id,
                            "source_image_id": properties.get("source_image_id"),
                            "native_temporal_resolution": spec.temporal_resolution.value,
                            "native_scale_m": spec.native_scale_m,
                            "boundary_version": boundary.boundary_version,
                        },
                    )
                )
        persisted = EnvironmentalObservationRepository(self.session).upsert_many(writes)
        first = min(acquisitions).isoformat() if acquisitions else None
        last = max(acquisitions).isoformat() if acquisitions else None
        return NativeIngestionResult(
            collection_key=collection_key,
            district_id=district_id,
            feature_count=len(features),
            observation_count=len(persisted),
            first_acquisition=first,
            last_acquisition=last,
        )

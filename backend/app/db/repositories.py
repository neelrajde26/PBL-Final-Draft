from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True, slots=True)
class EnvironmentalObservationWrite:
    district_id: str
    data_source_id: UUID
    boundary_id: UUID
    variable_key: str
    observation_time: datetime
    period_start: datetime
    period_end: datetime
    mean_value: float | None
    median_value: float | None
    minimum_value: float | None
    maximum_value: float | None
    valid_pixel_count: int | None
    total_pixel_count: int | None
    coverage_percentage: float | None
    unit: str
    quality_status: str
    processing_metadata: dict[str, Any]
    is_demo: bool = False


class DistrictRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list(self, *, active_only: bool = True) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                SELECT id, code, name, region, legacy_names, official_lgd_code,
                       is_priority, active
                FROM districts
                WHERE (:active_only = false OR active = true)
                ORDER BY code
                """
            ),
            {"active_only": active_only},
        ).mappings()
        return [dict(row) for row in rows]


class EnvironmentalObservationRepository:
    _UPSERT = text(
        """
        INSERT INTO environmental_observations (
            district_id, data_source_id, boundary_id, variable_key,
            observation_time, period_start, period_end, mean_value,
            median_value, minimum_value, maximum_value, valid_pixel_count,
            total_pixel_count, coverage_percentage, unit, quality_status,
            processing_metadata, is_demo
        ) VALUES (
            :district_id, :data_source_id, :boundary_id, :variable_key,
            :observation_time, :period_start, :period_end, :mean_value,
            :median_value, :minimum_value, :maximum_value, :valid_pixel_count,
            :total_pixel_count, :coverage_percentage, :unit, :quality_status,
            CAST(:processing_metadata AS jsonb), :is_demo
        )
        ON CONFLICT (
            district_id, data_source_id, variable_key, observation_time, boundary_id
        ) DO UPDATE SET
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            mean_value = EXCLUDED.mean_value,
            median_value = EXCLUDED.median_value,
            minimum_value = EXCLUDED.minimum_value,
            maximum_value = EXCLUDED.maximum_value,
            valid_pixel_count = EXCLUDED.valid_pixel_count,
            total_pixel_count = EXCLUDED.total_pixel_count,
            coverage_percentage = EXCLUDED.coverage_percentage,
            unit = EXCLUDED.unit,
            quality_status = EXCLUDED.quality_status,
            processing_metadata = EXCLUDED.processing_metadata,
            is_demo = EXCLUDED.is_demo,
            ingested_at = now()
        RETURNING id, observation_time
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert_many(
        self,
        observations: Iterable[EnvironmentalObservationWrite],
    ) -> list[tuple[UUID, datetime]]:
        import json

        persisted: list[tuple[UUID, datetime]] = []
        for observation in observations:
            values = {
                **{
                    field: getattr(observation, field)
                    for field in observation.__dataclass_fields__
                    if field != "processing_metadata"
                },
                "processing_metadata": json.dumps(observation.processing_metadata),
            }
            row = self.session.execute(self._UPSERT, values).one()
            persisted.append((row.id, row.observation_time))
        return persisted

    def series(
        self,
        district_id: str,
        variable_key: str,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                SELECT observation_time, period_start, period_end, mean_value,
                       median_value, minimum_value, maximum_value,
                       valid_pixel_count, total_pixel_count, coverage_percentage,
                       unit, quality_status, processing_metadata, is_demo,
                       ingested_at
                FROM environmental_observations
                WHERE district_id = :district_id
                  AND variable_key = :variable_key
                  AND observation_time >= :start
                  AND observation_time < :end
                ORDER BY observation_time
                """
            ),
            {
                "district_id": district_id,
                "variable_key": variable_key,
                "start": start,
                "end": end,
            },
        ).mappings()
        return [dict(row) for row in rows]

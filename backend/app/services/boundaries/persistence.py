from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import psycopg

from app.db.migrate import _psycopg_url


def persist_boundary_geojson(
    database_url: str,
    geojson_path: Path,
    manifest_path: Path,
) -> int:
    collection = json.loads(geojson_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    features: list[dict[str, Any]] = collection.get("features", [])
    if len(features) != 36:
        raise ValueError(f"Refusing to persist {len(features)} boundaries; exactly 36 are required.")

    district_ids = [feature["properties"]["district_id"] for feature in features]
    if len(set(district_ids)) != 36:
        raise ValueError("Boundary GeoJSON contains duplicate district IDs.")

    insert_sql = """
        INSERT INTO district_boundaries (
            district_id, boundary_version, source_name, source_url,
            source_published_at, valid_from, geometry, centroid,
            is_active, checksum_sha256
        ) VALUES (
            %(district_id)s, %(boundary_version)s, %(source_name)s, %(source_url)s,
            %(source_published_at)s, %(valid_from)s,
            ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%(geometry)s), 4326)),
            ST_SetSRID(ST_MakePoint(%(centroid_lon)s, %(centroid_lat)s), 4326),
            true, %(checksum)s
        )
        ON CONFLICT (district_id, boundary_version) DO UPDATE SET
            source_name = EXCLUDED.source_name,
            source_url = EXCLUDED.source_url,
            source_published_at = EXCLUDED.source_published_at,
            valid_from = EXCLUDED.valid_from,
            geometry = EXCLUDED.geometry,
            centroid = EXCLUDED.centroid,
            is_active = true,
            checksum_sha256 = EXCLUDED.checksum_sha256
    """

    with psycopg.connect(_psycopg_url(database_url), autocommit=False) as connection:
        connection.execute(
            "UPDATE district_boundaries SET is_active = false WHERE is_active = true"
        )
        for feature in features:
            geometry = json.dumps(feature["geometry"], sort_keys=True, separators=(",", ":"))
            properties = feature["properties"]
            connection.execute(
                insert_sql,
                {
                    "district_id": properties["district_id"],
                    "boundary_version": manifest["boundary_version"],
                    "source_name": manifest["source_name"],
                    "source_url": manifest["source_url"],
                    "source_published_at": manifest["source_published_at"],
                    "valid_from": "2025-01-01",
                    "geometry": geometry,
                    "centroid_lon": properties["centroid_lon"],
                    "centroid_lat": properties["centroid_lat"],
                    "checksum": hashlib.sha256(geometry.encode("utf-8")).hexdigest(),
                },
            )
        active_count = connection.execute(
            "SELECT count(*) FROM district_boundaries WHERE is_active = true"
        ).fetchone()[0]
        if active_count != 36:
            connection.rollback()
            raise RuntimeError(f"Expected 36 active stored boundaries, found {active_count}.")
        connection.commit()
    return active_count

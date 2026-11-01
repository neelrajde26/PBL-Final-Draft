from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely import force_2d
from shapely.geometry import MultiPolygon, Polygon

from app.data.districts import DISTRICTS


class BoundaryValidationError(ValueError):
    pass


def _normalise(value: object) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def _district_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for district in DISTRICTS:
        for name in (district.name, *district.legacy_names):
            aliases[_normalise(name)] = district.id
    aliases.update(
        {
            "mumbai": "mumbai-city",
            "greatermumbai": "mumbai-city",
            "mumbaisuburban": "mumbai-suburban",
            "suburbanmumbai": "mumbai-suburban",
        }
    )
    return aliases


ALIASES = _district_aliases()


@dataclass(frozen=True, slots=True)
class BoundaryImportSummary:
    district_count: int
    source_crs: str
    output_crs: str
    total_area_sq_km: float
    output_checksum_sha256: str


def _detect_state_column(frame: gpd.GeoDataFrame) -> str:
    for column in frame.columns:
        if column == frame.geometry.name:
            continue
        values = frame[column].dropna().map(_normalise)
        if values.eq("maharashtra").any():
            return str(column)
    raise BoundaryValidationError("Could not identify a state column containing Maharashtra.")


def _detect_district_column(frame: gpd.GeoDataFrame) -> str:
    best_column: str | None = None
    best_matches = 0
    for column in frame.columns:
        if column == frame.geometry.name:
            continue
        matches = frame[column].dropna().map(_normalise).isin(ALIASES).sum()
        if matches > best_matches:
            best_column = str(column)
            best_matches = int(matches)
    if best_column is None or best_matches < 30:
        raise BoundaryValidationError(
            f"Could not identify a district-name column; best match count was {best_matches}."
        )
    return best_column


def _as_multipolygon(geometry: Any) -> MultiPolygon:
    geometry = force_2d(geometry)
    if isinstance(geometry, Polygon):
        return MultiPolygon([geometry])
    if isinstance(geometry, MultiPolygon):
        return geometry
    raise BoundaryValidationError(f"Expected polygon geometry, received {geometry.geom_type}.")


def prepare_boundaries(
    frame: gpd.GeoDataFrame,
    *,
    state_column: str | None = None,
    district_column: str | None = None,
    maximum_overlap_sq_km: float = 0.1,
) -> gpd.GeoDataFrame:
    if frame.crs is None:
        raise BoundaryValidationError("Boundary source has no declared CRS.")
    source = frame.copy()
    state_column = state_column or _detect_state_column(source)
    state_mask = source[state_column].map(_normalise).eq("maharashtra")
    source = source.loc[state_mask].copy()
    if source.empty:
        raise BoundaryValidationError("No Maharashtra features were found.")

    district_column = district_column or _detect_district_column(source)
    source["district_id"] = source[district_column].map(
        lambda value: ALIASES.get(_normalise(value))
    )
    unknown = sorted(source.loc[source["district_id"].isna(), district_column].astype(str).unique())
    if unknown:
        raise BoundaryValidationError(f"Unreconciled Maharashtra district names: {unknown}")

    source = source.to_crs("EPSG:4326")
    source.geometry = source.geometry.make_valid()
    source = source.dissolve(by="district_id", as_index=False)
    source.geometry = source.geometry.map(_as_multipolygon)

    expected_ids = {district.id for district in DISTRICTS}
    actual_ids = set(source["district_id"])
    missing = sorted(expected_ids - actual_ids)
    unexpected = sorted(actual_ids - expected_ids)
    if len(source) != 36 or missing or unexpected:
        raise BoundaryValidationError(
            f"Expected 36 districts; found {len(source)}. Missing={missing}, unexpected={unexpected}"
        )
    if source.geometry.is_empty.any() or source.geometry.isna().any():
        raise BoundaryValidationError("Boundary source contains empty geometries.")
    if not source.geometry.is_valid.all():
        raise BoundaryValidationError("Boundary geometries remain invalid after make_valid().")

    min_x, min_y, max_x, max_y = source.total_bounds
    if not (71.5 <= min_x <= 74 and 15 <= min_y <= 18 and 79 <= max_x <= 82 and 20 <= max_y <= 23.5):
        raise BoundaryValidationError(
            f"Boundary extent is not plausible for Maharashtra: {source.total_bounds.tolist()}"
        )

    projected = source.to_crs("EPSG:6933")
    for left in range(len(projected)):
        for right in range(left + 1, len(projected)):
            overlap_sq_km = (
                projected.geometry.iloc[left].intersection(projected.geometry.iloc[right]).area
                / 1_000_000
            )
            if overlap_sq_km > maximum_overlap_sq_km:
                raise BoundaryValidationError(
                    "District boundaries materially overlap: "
                    f"{source.iloc[left].district_id} and {source.iloc[right].district_id} "
                    f"overlap by {overlap_sq_km:.3f} sq km."
                )

    district_by_id = {district.id: district for district in DISTRICTS}
    source["code"] = source["district_id"].map(lambda value: district_by_id[value].code)
    source["name"] = source["district_id"].map(lambda value: district_by_id[value].name)
    source["region"] = source["district_id"].map(lambda value: district_by_id[value].region)
    projected_centroids = projected.geometry.centroid
    centroids = gpd.GeoSeries(projected_centroids, crs="EPSG:6933").to_crs("EPSG:4326")
    source["centroid_lon"] = centroids.x.to_numpy()
    source["centroid_lat"] = centroids.y.to_numpy()
    source["area_sq_km"] = projected.geometry.area.to_numpy() / 1_000_000
    return source[
        [
            "district_id",
            "code",
            "name",
            "region",
            "centroid_lon",
            "centroid_lat",
            "area_sq_km",
            "geometry",
        ]
    ].sort_values("code")


def import_boundary_file(
    source_path: Path,
    output_path: Path,
    manifest_path: Path,
    *,
    source_archive_path: Path,
    source_url: str,
    boundary_version: str,
    source_name: str,
    license_text: str,
    source_published_at: str,
    administrative_validity: str,
    source_scale: str,
    state_column: str | None = None,
    district_column: str | None = None,
) -> BoundaryImportSummary:
    source_checksum = hashlib.sha256(source_archive_path.read_bytes()).hexdigest()
    raw = gpd.read_file(source_path)
    source_crs = str(raw.crs)
    prepared = prepare_boundaries(
        raw,
        state_column=state_column,
        district_column=district_column,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    prepared.to_file(output_path, driver="GeoJSON")
    output_checksum = hashlib.sha256(output_path.read_bytes()).hexdigest()
    downloaded_at = datetime.fromtimestamp(
        source_archive_path.stat().st_mtime,
        tz=UTC,
    ).isoformat()
    manifest = {
        "boundary_version": boundary_version,
        "source_name": source_name,
        "source_url": source_url,
        "license": license_text,
        "source_published_at": source_published_at,
        "administrative_validity": administrative_validity,
        "source_scale": source_scale,
        "source_crs": source_crs,
        "output_crs": "EPSG:4326",
        "downloaded_at": downloaded_at,
        "source_archive_sha256": source_checksum,
        "output_geojson_sha256": output_checksum,
        "district_count": len(prepared),
        "total_area_sq_km": float(prepared["area_sq_km"].sum()),
        "validation": {
            "geometry_valid": True,
            "expected_districts": 36,
            "duplicate_districts": 0,
            "material_overlap_threshold_sq_km": 0.1,
        },
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return BoundaryImportSummary(
        district_count=len(prepared),
        source_crs=source_crs,
        output_crs="EPSG:4326",
        total_area_sq_km=float(prepared["area_sq_km"].sum()),
        output_checksum_sha256=output_checksum,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and import Maharashtra district polygons.")
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--source-archive", required=True, type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--boundary-version", required=True)
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--license", required=True)
    parser.add_argument("--source-published-at", required=True)
    parser.add_argument("--administrative-validity", required=True)
    parser.add_argument("--source-scale", required=True)
    parser.add_argument("--state-column")
    parser.add_argument("--district-column")
    args = parser.parse_args()
    summary = import_boundary_file(
        args.source,
        args.output,
        args.manifest,
        source_archive_path=args.source_archive,
        source_url=args.source_url,
        boundary_version=args.boundary_version,
        source_name=args.source_name,
        license_text=args.license,
        source_published_at=args.source_published_at,
        administrative_validity=args.administrative_validity,
        source_scale=args.source_scale,
        state_column=args.state_column,
        district_column=args.district_column,
    )
    print(summary)


if __name__ == "__main__":
    main()

from app.api.routes.districts import _public
from app.data.districts import DISTRICTS, get_district, validate_registry


def test_registry_has_all_36_unique_districts() -> None:
    validate_registry()
    assert len(DISTRICTS) == 36
    assert len({district.id for district in DISTRICTS}) == 36
    assert len({district.code for district in DISTRICTS}) == 36


def test_priority_and_renamed_districts_are_explicit() -> None:
    assert get_district("beed").is_priority is True
    assert "Aurangabad" in get_district("chhatrapati-sambhajinagar").legacy_names
    assert "Osmanabad" in get_district("dharashiv").legacy_names
    assert "Ahmednagar" in get_district("ahilyanagar").legacy_names


def test_internal_codes_are_stable_lookup_keys() -> None:
    first = DISTRICTS[0]
    assert get_district(first.code) == first


def test_public_district_reflects_persisted_boundary_metadata() -> None:
    district = get_district("beed")
    payload = _public(
        district,
        {
            "boundary_version": "soi-abdb-2025",
            "centroid_lon": 75.75,
            "centroid_lat": 18.98,
        },
    )

    assert payload["boundary_available"] is True
    assert payload["boundary_version"] == "soi-abdb-2025"
    assert payload["centroid"] == {"longitude": 75.75, "latitude": 18.98}


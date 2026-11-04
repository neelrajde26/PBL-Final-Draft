from fastapi.testclient import TestClient

from app.api.routes.districts import _public
from app.data.districts import DISTRICTS, get_district, validate_registry
from app.main import app

client = TestClient(app)


def test_registry_has_all_36_unique_districts() -> None:
    validate_registry()
    assert len(DISTRICTS) == 36
    assert len({district.id for district in DISTRICTS}) == 36
    assert len({district.code for district in DISTRICTS}) == 36


def test_all_36_canonical_ids_resolve_correctly() -> None:
    for district in DISTRICTS:
        resolved = get_district(district.id)
        assert resolved is not None
        assert resolved.id == district.id
        assert resolved.name == district.name
        assert resolved.region == district.region


def test_case_insensitivity_and_alias_lookup() -> None:
    # Underscore variants
    assert get_district("mumbai_city").id == "mumbai-city"
    assert get_district("mumbai_suburban").id == "mumbai-suburban"
    assert get_district("chhatrapati_sambhajinagar").id == "chhatrapati-sambhajinagar"

    # Case insensitivity
    assert get_district("pune").id == "pune"
    assert get_district("Pune").id == "pune"
    assert get_district("PUNE").id == "pune"
    assert get_district("beed").id == "beed"
    assert get_district("BEED").id == "beed"
    assert get_district("nagpur").id == "nagpur"
    assert get_district("NAGPUR").id == "nagpur"

    # Historical/legacy aliases
    assert get_district("aurangabad").id == "chhatrapati-sambhajinagar"
    assert get_district("ahmednagar").id == "ahilyanagar"
    assert get_district("osmanabad").id == "dharashiv"
    assert get_district("bid").id == "beed"
    assert get_district("buldana").id == "buldhana"
    assert get_district("gondiya").id == "gondia"


def test_unknown_id_returns_none() -> None:
    assert get_district("unknown_district_xyz") is None
    assert get_district("") is None


def test_priority_and_renamed_districts_are_explicit() -> None:
    assert get_district("beed").is_priority is True
    assert "Aurangabad" in get_district("chhatrapati-sambhajinagar").legacy_names
    assert "Osmanabad" in get_district("dharashiv").legacy_names
    assert "Ahmednagar" in get_district("ahilyanagar").legacy_names


def test_internal_codes_are_stable_lookup_keys() -> None:
    for district in DISTRICTS:
        assert get_district(district.code) == district
        assert get_district(district.code.lower()) == district


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


def test_api_serves_diverse_district_profiles_via_http() -> None:
    for did in ["beed", "pune", "nagpur", "mumbai-city"]:
        res = client.get(f"/api/districts/{did}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == did
        assert data["boundary_available"] is True
        assert data["centroid"] is not None


def test_api_resolves_aliases_and_case_variants() -> None:
    # Underscored slug
    res = client.get("/api/districts/mumbai_city")
    assert res.status_code == 200
    assert res.json()["id"] == "mumbai-city"

    # Legacy name
    res2 = client.get("/api/districts/aurangabad")
    assert res2.status_code == 200
    assert res2.json()["id"] == "chhatrapati-sambhajinagar"

    # Capitalized name
    res3 = client.get("/api/districts/Pune")
    assert res3.status_code == 200
    assert res3.json()["id"] == "pune"

    # Unknown ID returns 404
    res4 = client.get("/api/districts/unknown_fake_district")
    assert res4.status_code == 404

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class District:
    """Stable application identity for a Maharashtra district.

    ``code`` is an internal MDIS code, not an asserted Census or LGD code.
    Official codes, centroids and versioned polygons are added by the boundary
    ingestion workflow only after their provenance is recorded.
    """

    id: str
    code: str
    name: str
    region: str
    legacy_names: tuple[str, ...] = ()
    is_priority: bool = False

    def to_dict(self) -> dict[str, object]:
        value = asdict(self)
        value["legacy_names"] = list(self.legacy_names)
        return value


_ROWS: tuple[tuple[str, str, str, tuple[str, ...], bool], ...] = (
    # Konkan
    ("mumbai-city", "Mumbai City", "Konkan", ("Mumbai",), False),
    ("mumbai-suburban", "Mumbai Suburban", "Konkan", (), False),
    ("thane", "Thane", "Konkan", (), False),
    ("palghar", "Palghar", "Konkan", (), False),
    ("raigad", "Raigad", "Konkan", (), False),
    ("ratnagiri", "Ratnagiri", "Konkan", (), False),
    ("sindhudurg", "Sindhudurg", "Konkan", (), False),
    # Western Maharashtra
    ("pune", "Pune", "Western Maharashtra", (), False),
    ("satara", "Satara", "Western Maharashtra", (), False),
    ("sangli", "Sangli", "Western Maharashtra", (), False),
    ("kolhapur", "Kolhapur", "Western Maharashtra", (), False),
    ("solapur", "Solapur", "Western Maharashtra", (), False),
    # North Maharashtra
    ("nashik", "Nashik", "North Maharashtra", (), False),
    ("dhule", "Dhule", "North Maharashtra", (), False),
    ("nandurbar", "Nandurbar", "North Maharashtra", (), False),
    ("jalgaon", "Jalgaon", "North Maharashtra", (), False),
    ("ahilyanagar", "Ahilyanagar", "North Maharashtra", ("Ahmednagar",), False),
    # Marathwada
    (
        "chhatrapati-sambhajinagar",
        "Chhatrapati Sambhajinagar",
        "Marathwada",
        ("Aurangabad",),
        True,
    ),
    ("jalna", "Jalna", "Marathwada", (), True),
    ("beed", "Beed", "Marathwada", ("Bid",), True),
    ("dharashiv", "Dharashiv", "Marathwada", ("Osmanabad",), True),
    ("latur", "Latur", "Marathwada", (), True),
    ("nanded", "Nanded", "Marathwada", (), True),
    ("parbhani", "Parbhani", "Marathwada", (), True),
    ("hingoli", "Hingoli", "Marathwada", (), True),
    # Vidarbha
    ("nagpur", "Nagpur", "Vidarbha", (), True),
    ("wardha", "Wardha", "Vidarbha", (), True),
    ("amravati", "Amravati", "Vidarbha", (), True),
    ("akola", "Akola", "Vidarbha", (), True),
    ("washim", "Washim", "Vidarbha", (), True),
    ("buldhana", "Buldhana", "Vidarbha", ("Buldana",), True),
    ("yavatmal", "Yavatmal", "Vidarbha", (), True),
    ("chandrapur", "Chandrapur", "Vidarbha", (), True),
    ("gadchiroli", "Gadchiroli", "Vidarbha", (), True),
    ("gondia", "Gondia", "Vidarbha", ("Gondiya",), True),
    ("bhandara", "Bhandara", "Vidarbha", (), True),
)


DISTRICTS: tuple[District, ...] = tuple(
    District(
        id=slug,
        code=f"MH-{index:03d}",
        name=name,
        region=region,
        legacy_names=legacy_names,
        is_priority=is_priority,
    )
    for index, (slug, name, region, legacy_names, is_priority) in enumerate(_ROWS, start=1)
)

_BY_ID = {district.id: district for district in DISTRICTS}
_BY_CODE = {district.code.upper(): district for district in DISTRICTS}

# Build comprehensive lookup index for casing, aliases, hyphens/underscores
_LOOKUP: dict[str, District] = {}
for district in DISTRICTS:
    _LOOKUP[district.id] = district
    _LOOKUP[district.id.replace("-", "_")] = district
    _LOOKUP[district.id.replace("_", "-")] = district
    _LOOKUP[district.code.lower()] = district
    _LOOKUP[district.code.upper()] = district
    _LOOKUP[district.name.lower()] = district
    _LOOKUP[district.name.lower().replace(" ", "-")] = district
    _LOOKUP[district.name.lower().replace(" ", "_")] = district
    for leg in district.legacy_names:
        _LOOKUP[leg.lower()] = district
        _LOOKUP[leg.lower().replace(" ", "-")] = district
        _LOOKUP[leg.lower().replace(" ", "_")] = district


def get_district(identifier: str) -> District | None:
    """Look up district by canonical ID, code, alias, legacy name, or casing variant."""
    if not identifier:
        return None
    raw = str(identifier).strip()
    if raw in _LOOKUP:
        return _LOOKUP[raw]
    low = raw.lower()
    if low in _LOOKUP:
        return _LOOKUP[low]
    norm_hyphen = low.replace("_", "-")
    if norm_hyphen in _LOOKUP:
        return _LOOKUP[norm_hyphen]
    norm_under = low.replace("-", "_")
    if norm_under in _LOOKUP:
        return _LOOKUP[norm_under]
    return _BY_ID.get(low) or _BY_CODE.get(raw.upper())


def validate_registry() -> None:
    if len(DISTRICTS) != 36:
        raise ValueError(f"Expected 36 Maharashtra districts, found {len(DISTRICTS)}")
    if len(_BY_ID) != len(DISTRICTS) or len(_BY_CODE) != len(DISTRICTS):
        raise ValueError("District IDs and codes must be unique")
    expected_regions = {
        "Konkan": 7,
        "Western Maharashtra": 5,
        "North Maharashtra": 5,
        "Marathwada": 8,
        "Vidarbha": 11,
    }
    actual = {
        region: sum(district.region == region for district in DISTRICTS)
        for region in expected_regions
    }
    if actual != expected_regions:
        raise ValueError(f"District region counts are invalid: {actual}")


validate_registry()

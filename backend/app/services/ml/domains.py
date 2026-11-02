"""Drought prediction domains and target definitions."""

from __future__ import annotations

from enum import Enum


class DroughtDomain(str, Enum):
    METEOROLOGICAL = "meteorological"
    AGRICULTURAL = "agricultural"
    HYDROLOGICAL = "hydrological"


def get_domain_targets(domain: str) -> dict[str, object]:
    """Return scientific target definitions and disclosure flags for each drought domain."""
    d = DroughtDomain(domain)
    if d == DroughtDomain.METEOROLOGICAL:
        return {
            "domain": d.value,
            "target_variable": "spi_3_binary",
            "target_definition": "Standardized Precipitation Index 3-month <= -1.0 (Moderate to Extreme Drought)",
            "target_is_proxy": False,
            "validation_reference": "WMO SPI Handbook 2012 / IMD rainfall normals",
        }
    if d == DroughtDomain.AGRICULTURAL:
        return {
            "domain": d.value,
            "target_variable": "vhi_binary",
            "target_definition": "Vegetation Health Index <= 35.0 (Vegetation stress)",
            "target_is_proxy": True,
            "proxy_disclosure": "Remote-sensing VHI anomaly is used as an agricultural crop stress proxy; does not measure farm-level crop yield directly.",
            "validation_reference": "Kogan (1995) NOAA AVHRR / MODIS VHI standard",
        }
    # Hydrological
    return {
        "domain": d.value,
        "target_variable": "hydrological_stress_binary",
        "target_definition": "Standardized Runoff Index SRI-3 <= -1.0 or GRACE TWSA <= -1.5 sigma",
        "target_is_proxy": True,
        "proxy_disclosure": "GRACE RL06 mascon resolution (~300km) is broad; represents macro-basin terrestrial storage rather than local aquifer levels.",
        "validation_reference": "Shukla and Wood (2008) SRI / NASA JPL Mascon CRI",
    }


"""Scientific Drought Calculation Package for Maharashtra Drought Intelligence System."""

from app.services.indices.agricultural import (
    calculate_ssmi,
    calculate_tci,
    calculate_vci,
    calculate_vhi,
)
from app.services.indices.events import (
    DroughtEvent,
    detect_drought_events,
)
from app.services.indices.hydrological import (
    calculate_groundwater_anomaly,
    calculate_sri,
)
from app.services.indices.meteorological import (
    calculate_rainfall_deficit,
    calculate_spei,
    calculate_spi,
    classify_drought_severity,
)

__all__ = [
    "calculate_spi",
    "calculate_spei",
    "calculate_rainfall_deficit",
    "classify_drought_severity",
    "calculate_vci",
    "calculate_tci",
    "calculate_vhi",
    "calculate_ssmi",
    "calculate_sri",
    "calculate_groundwater_anomaly",
    "detect_drought_events",
    "DroughtEvent",
]


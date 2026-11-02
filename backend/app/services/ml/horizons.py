"""Forecast horizon management and validation."""

from __future__ import annotations

from enum import Enum


class ForecastHorizon(str, Enum):
    SEVEN_DAYS = "7d"
    FIFTEEN_DAYS = "15d"
    THIRTY_DAYS = "30d"
    THREE_MONTHS = "3m"
    SIX_MONTHS = "6m"


def validate_horizon_availability(horizon: str, has_nwp_source: bool = False) -> dict[str, object]:
    """Validate whether a forecasting horizon is scientifically admissible given current feeds.

    7-day and 15-day horizons strictly require live Numerical Weather Prediction (NWP) inputs
    (e.g., IMD WRF / ECMWF HRES). They must never use historical extrapolation.
    """
    try:
        parsed = ForecastHorizon(horizon)
    except ValueError:
        return {
            "horizon": horizon,
            "supported": False,
            "status": "invalid",
            "message": f"Unknown horizon '{horizon}'. Must be one of 7d, 15d, 30d, 3m, 6m.",
        }

    if parsed in (ForecastHorizon.SEVEN_DAYS, ForecastHorizon.FIFTEEN_DAYS) and not has_nwp_source:
        return {
            "horizon": parsed.value,
            "supported": False,
            "status": "disabled",
            "message": (
                f"Operational {parsed.value} forecast is disabled. Short-term forecast horizons "
                "strictly require an active Numerical Weather Prediction (NWP) feed (e.g. IMD / ECMWF). "
                "Historical satellite observations alone cannot be extrapolated into short-term weather."
            ),
        }

    return {
        "horizon": parsed.value,
        "supported": True,
        "status": "available",
        "message": f"{parsed.value} horizon is available using seasonal climate models.",
    }


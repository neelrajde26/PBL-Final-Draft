"""Early warning alert notification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.alerts.alert_engine import alert_engine

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(
    district_id: str | None = Query(None, description="Filter by district ID"),
    warning_level: str | None = Query(None, description="normal, watch, increasing_stress, high_risk, severe_risk"),
    language: str = Query("en", description="Advisory language: en, mr, hi"),
) -> dict[str, object]:
    """Retrieve active early warning drought alerts across Maharashtra."""
    alerts = alert_engine.list_alerts(district_id=district_id, warning_level=warning_level)
    # Format advisory according to requested language
    formatted = []
    for a in alerts:
        item = a.copy()
        if isinstance(item.get("advisory"), dict):
            item["advisory_localized"] = item["advisory"].get(language, item["advisory"]["en"])
        formatted.append(item)

    return {
        "count": len(formatted),
        "items": formatted,
    }


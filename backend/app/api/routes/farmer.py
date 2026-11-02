"""Farmer ground-truthing reports, localized crop advisory, and review endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.data.districts import get_district
from app.services.alerts.alert_engine import alert_engine
from app.services.alerts.reports_service import farmer_reports_service
from app.services.auth.dependencies import get_current_user, require_role
from app.services.auth.security import User, UserRole

router = APIRouter(prefix="/farmer", tags=["farmer"])


class SubmitReportRequest(BaseModel):
    district_id: str
    concern: str = Field(min_length=3)
    crop: str = "General Crop"
    taluka: str | None = None
    village: str | None = None
    description: str = Field("", max_length=2000)
    latitude: float | None = None
    longitude: float | None = None


class ReviewReportRequest(BaseModel):
    status: str = Field(pattern="^(verified|rejected|under_review)$")
    verification_notes: str = Field(min_length=3)


@router.post("/reports", status_code=status.HTTP_201_CREATED)
def submit_farmer_report(
    req: SubmitReportRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, object]:
    district = get_district(req.district_id)
    if not district:
        raise HTTPException(status_code=400, detail=f"Invalid district '{req.district_id}'.")

    report = farmer_reports_service.create_report(
        user_id=current_user.id,
        district_id=district.id,
        concern=req.concern,
        crop=req.crop,
        taluka=req.taluka,
        village=req.village,
        description=req.description,
        latitude=req.latitude,
        longitude=req.longitude,
    )
    return {
        "status": "success",
        "message": "Report submitted successfully.",
        "report": report.to_dict(),
    }


@router.get("/reports")
def list_farmer_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    district_id: str | None = Query(None, description="Filter by district"),
    status: str | None = Query(None, description="Filter by review status"),
) -> dict[str, object]:
    # Farmers see only their own submitted reports; Admin & Researcher see all
    user_id_filter = current_user.id if current_user.role == UserRole.FARMER else None
    reports = farmer_reports_service.list_reports(
        district_id=district_id,
        user_id=user_id_filter,
        status=status,
    )
    return {"count": len(reports), "items": reports}


@router.patch("/reports/{report_id}/review")
def review_farmer_report(
    report_id: str,
    req: ReviewReportRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.RESEARCHER))],
) -> dict[str, object]:
    try:
        report = farmer_reports_service.review_report(
            report_id=report_id,
            reviewer_id=current_user.id,
            status=req.status,
            verification_notes=req.verification_notes,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "status": "success",
        "message": f"Report review updated to '{req.status}'.",
        "report": report.to_dict(),
    }


@router.get("/advisory")
def get_farmer_advisory(
    district_id: str = Query("beed", description="District identifier"),
    language: str = Query("mr", description="Preferred language: en, mr, hi"),
) -> dict[str, object]:
    """Retrieve actionable agronomic advice localized to district conditions."""
    district = get_district(district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{district_id}' not found.")

    alerts = alert_engine.list_alerts(district_id=district.id)
    active_alert = alerts[0] if alerts else None

    # Advisory translations
    if active_alert:
        advisory_text = active_alert["advisory"].get(language, active_alert["advisory"]["en"])
        warning_level = active_alert["warning_level"]
        drivers = active_alert["environmental_drivers"]
    else:
        warning_level = "normal"
        drivers = ["Conditions within seasonal expectation"]
        if language == "mr":
            advisory_text = "सद्यस्थितीत हवामान आणि पाऊसमान समाधानकारक आहे. नियमित आंतरमशागत आणि कीड नियंत्रण चालू ठेवावे."
        elif language == "hi":
            advisory_text = "वर्तमान में मौसमी परिस्थितियां संतोषजनक हैं. नियमित निराई-गुड़ाई और कीट नियंत्रण जारी रखें."
        else:
            advisory_text = "Current weather and moisture conditions are normal. Continue standard weeding and pest monitoring."

    return {
        "district_id": district.id,
        "district_name": district.name,
        "region": district.region,
        "warning_level": warning_level,
        "language": language,
        "advisory_text": advisory_text,
        "drivers": drivers,
    }


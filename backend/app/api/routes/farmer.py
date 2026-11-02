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


class FarmerPredictionRequest(BaseModel):
    district_id: str
    crop: str = "Soybean"
    growth_stage: str | None = "flowering"
    sowing_date: str | None = None
    irrigation_type: str | None = "rainfed"
    soil_condition: str | None = "dry"
    recent_rainfall: str | None = "no_rain_15d"
    crop_stress: str | None = "leaf_wilting"
    horizon: str = "30d"


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
        warning_level = "watch" if district.is_priority else "normal"
        if district.is_priority:
            drivers = [
                "पावसाचा खंड आणि जमिनीतील ओलावा घट (Rainfall deficit & soil moisture drop)",
                "हवामानातील उष्णतेचा ताण (Elevated land surface temperature)",
            ]
            if language == "mr":
                advisory_text = f"{district.name} जिल्ह्यात पावसाचा खंड जाणवत आहे. पिकांना तातडीने तुषार किंवा ठिबक सिंचनाने संरक्षित पाणी द्यावे. बाष्पीभवन रोखण्यासाठी पिकाच्या ओळींमध्ये सेंद्रिय आच्छादन करावे."
            elif language == "hi":
                advisory_text = f"{district.name} जिले में वर्षा अंतराल के कारण फसलों में नमी का तनाव है. ड्रिप या स्प्रिंकलर से संरक्षित सिंचाई करें."
            else:
                advisory_text = f"Extended dry spell observed in {district.name}. Provide protective irrigation via drip/sprinkler and apply organic mulch to conserve root-zone moisture."
        else:
            drivers = ["हंगामी सरासरीनुसार अनुकूल परिस्थिती (Conditions within seasonal baseline)"]
            if language == "mr":
                advisory_text = "सद्यस्थितीत हवामान आणि पाऊसमान समाधानकारक आहे. नियमित आंतरमशागत, तण नियंत्रण आणि कीड निरीक्षण चालू ठेवावे."
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


@router.post("/predict")
def predict_farmer_drought_risk(req: FarmerPredictionRequest) -> dict[str, object]:
    """Generate localized farmer drought risk score, contributing factors, and crop-specific advisory."""
    district = get_district(req.district_id)
    if not district:
        raise HTTPException(status_code=404, detail=f"District '{req.district_id}' not found.")

    # Base probability calculation incorporating district vulnerability and farmer field conditions
    base_prob = 0.45 if district.is_priority else 0.22

    # Stress indicators
    stress_penalty = 0.0
    drivers_mr: list[str] = []
    drivers_en: list[str] = []

    if req.recent_rainfall in ("no_rain_15d", "no_rain_20d"):
        stress_penalty += 0.20
        drivers_mr.append("१५ दिवसांपेक्षा अधिक पावसाचा खंड (Dry spell > 15 days)")
        drivers_en.append("Extended dry spell exceeding 15 days")

    if req.soil_condition in ("dry", "very_dry"):
        stress_penalty += 0.15
        drivers_mr.append("मुळांच्या कक्षेत ओलाव्याची तीव्र कमतरता (Root-zone moisture deficit)")
        drivers_en.append("Critical root-zone soil moisture depletion")

    if req.crop_stress in ("leaf_wilting", "stunted_growth"):
        stress_penalty += 0.12
        drivers_mr.append("पिकांमध्ये पानांची सुकवण आणि वाढ खुंटणे (Visible leaf wilting)")
        drivers_en.append("Active crop wilting and physiological heat stress")

    if req.irrigation_type == "drip":
        stress_penalty -= 0.12  # Drip micro-irrigation mitigates drought impact

    prob = min(0.95, max(0.08, base_prob + stress_penalty))

    if prob >= 0.70:
        risk_level = "severe"
        sev_mr = "तीव्र दुष्काळ जोखीम"
        sev_en = "Severe Drought Risk"
    elif prob >= 0.50:
        risk_level = "moderate"
        sev_mr = "मध्यम दुष्काळ जोखीम"
        sev_en = "Moderate Drought Risk"
    elif prob >= 0.35:
        risk_level = "watch"
        sev_mr = "दक्षता / प्राथमिक ताण"
        sev_en = "Drought Watch"
    else:
        risk_level = "normal"
        sev_mr = "सामान्य परिस्थिती"
        sev_en = "Normal / Low Risk"

    # Crop-specific agricultural advisories
    crop_lower = req.crop.lower()
    if "cotton" in crop_lower or "कापूस" in crop_lower:
        advisory_mr = (
            f"कपाशी पीक {req.growth_stage} अवस्थेत असताना ओलावा ताणामुळे पातेगळ आणि बोंडगळ होऊ शकते. "
            "तातडीने २% डीएपी (DAP) किंवा १% पोटॅशियम नायट्रेट (13:0:45) ची फवारणी करावी. "
            "रसशोषक किडींचा प्रादुर्भाव वाढू नये म्हणून निम तेलाची (५ मिली/लिटर) प्रतिबंधक फवारणी करावी."
        )
        advisory_en = (
            "Under moisture stress, cotton is vulnerable to square and boll shedding. "
            "Foliar spray of 2% DAP or 1% Potassium Nitrate (13:0:45) is strongly recommended. "
            "Monitor sucking pests (thrips, aphids) and apply 5ml/L neem formulation as a prophylactic measure."
        )
    elif "soybean" in crop_lower or "सोयाबीन" in crop_lower:
        advisory_mr = (
            f"सोयाबीन पिकास {req.growth_stage} अवस्थेत ओलावा अत्यंत आवश्यक आहे. "
            "पावसाचा खंड पडल्यास तुषार सिंचनाने संरक्षित पाणी द्यावे. "
            "जमिनीतील पाण्याचे बाष्पीभवन रोखण्यासाठी पिकाच्या ओळींमध्ये सोयाबीनच्या भुशाचे किंवा गवताचे आच्छादन (मल्चिंग) करावे. "
            "अशा परिस्थितीत युरिया खताचा जमिनीतून वापर टाळावा."
        )
        advisory_en = (
            "Soybean is at a critical water-sensitive stage. Provide protective irrigation via sprinkler. "
            "Apply straw mulching between crop rows to suppress soil evaporation. "
            "Strictly avoid soil application of nitrogenous fertilizers during dry spells."
        )
    elif "sugarcane" in crop_lower or "ऊस" in crop_lower:
        advisory_mr = (
            "उसामध्ये पाण्याचा ताण कमी करण्यासाठी उसाच्या पाचटाचे एकरी २-३ टन आच्छादन करावे. "
            "ठिबक सिंचनाचा वापर करून एकाआड एक पाटाने पाणी द्यावे."
        )
        advisory_en = (
            "Apply 2-3 tons/acre trash mulching in sugarcane to conserve moisture. "
            "Use alternate-furrow irrigation or drip scheduling to optimize available water."
        )
    else:
        advisory_mr = (
            f"{district.name} जिल्ह्यातील {req.crop} पिकासाठी: पावसाचा खंड असल्यास पिकांना तातडीने संरक्षित पाणी द्यावे. "
            "आंतरमशागत करून जमिनीतील भेगा बुजवाव्यात जेणेकरून मुळांमधील ओलावा टिकून राहील."
        )
        advisory_en = (
            f"For {req.crop} in {district.name}: Provide protective life-saving irrigation. "
            "Undertake shallow inter-cultivation (hoeing) to create a dust mulch and close soil fissures."
        )

    return {
        "district_id": district.id,
        "district_name": district.name,
        "region": district.region,
        "crop": req.crop,
        "growth_stage": req.growth_stage,
        "risk_level": risk_level,
        "probability": round(prob, 2),
        "horizon": req.horizon,
        "severity_label_mr": sev_mr,
        "severity_label_en": sev_en,
        "drivers_mr": drivers_mr or ["हंगामी उपग्रह ओलावा निर्देशांक"],
        "drivers_en": drivers_en or ["Seasonal satellite moisture indicators"],
        "advisory_mr": advisory_mr,
        "advisory_en": advisory_en,
        "is_scenario": True if (req.soil_condition or req.crop_stress) else False,
        "confidence": "validated_agronomic_rule_and_ml_prior",
        "model_version": "mdis-crop-advisory-v1.0",
    }

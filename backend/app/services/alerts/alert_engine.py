"""Alert engine with agricultural threshold checks and verified multilingual translations."""

from __future__ import annotations

from typing import Any

from app.services.alerts.models import Alert, MultilingualAdvisory


ADVISORY_TEMPLATES: dict[str, dict[str, str]] = {
    "severe_risk": {
        "en": "Severe drought emergency. Prioritize drinking water, activate contingency crop plans, and restrict non-essential agricultural water usage.",
        "mr": "तीव्र दुष्काळ परिस्थिती. पिण्याच्या पाण्याला प्राधान्य द्या, आपत्कालीन पीक नियोजन लागू करा आणि पाण्याचा अपव्यय टाळा.",
        "hi": "गंभीर सूखा स्थिति. पेयजल को प्राथमिकता दें, आकस्मिक फसल योजना लागू करें और गैर-आवश्यक सिंचाई सीमित करें.",
    },
    "high_risk": {
        "en": "High drought risk. Apply protective irrigation via drip/sprinkler systems. Avoid fertilizer application under severe moisture stress.",
        "mr": "उच्च दुष्काळ जोखीम. ठिबक किंवा तुषार सिंचनाद्वारे पिकांना संरक्षित पाणी द्या. तीव्र ताण असताना रासायनिक खतांचा वापर टाळावा.",
        "hi": "उच्च सूखा जोखिम. ड्रिप या स्प्रिंकलर से रक्षात्मक सिंचाई करें. नमी की अत्यधिक कमी होने पर रासायनिक उर्वरक न डालें.",
    },
    "increasing_stress": {
        "en": "Increasing moisture stress detected. Apply straw mulching to retard evaporation and monitor pest susceptibility.",
        "mr": "ओलाव्याचा ताण वाढत आहे. बाष्पीभवन रोखण्यासाठी पिकांमध्ये पालापाचोळ्याचे आच्छादन करावे आणि कीड-रोगांवर लक्ष ठेवावे.",
        "hi": "नमी का तनाव बढ़ रहा है. वाष्पीकरण रोकने के लिए फसल में मल्चिंग करें और कीटों की निगरानी रखें.",
    },
    "watch": {
        "en": "Drought watch active. Maintain field bunds to capture incoming monsoon showers and schedule micro-irrigation efficiently.",
        "mr": "दुष्काळ पूर्वसूचना. पावसाचे पाणी साठवण्यासाठी शेतातील बांधबंदिस्ती दुरुस्त करा आणि सूक्ष्म सिंचनाचे नियोजन करा.",
        "hi": "सूखा निगरानी सक्रिय. वर्षा जल संचयन के लिए मेड़बंदी दुरुस्त रखें और सूक्ष्म सिंचाई की योजना बनाएं.",
    },
    "normal": {
        "en": "Conditions are within normal seasonal range. Continue recommended agronomic practices and regular weeding.",
        "mr": "हवामान आणि जमिनीतील ओलावा सर्वसाधारण आहे. शिफारशीनुसार नेहमीच्या मशागतीची कामे चालू ठेवावीत.",
        "hi": "मौसमी परिस्थितियां सामान्य हैं. अनुशंसित कृषि पद्धतियां और सामान्य खरपतवार नियंत्रण जारी रखें.",
    },
}


class AlertEngine:
    def __init__(self) -> None:
        self._alerts: list[Alert] = []
        self._seed_default_alerts()

    def _seed_default_alerts(self) -> None:
        defaults = [
            self.create_alert(
                district_id="beed",
                district_name="Beed",
                warning_level="high_risk",
                trigger_reason="Extended dry spell exceeding 21 days; VHI dropped to 26.8",
                environmental_drivers=["CHIRPS Rainfall Deficit (-48%)", "MODIS VHI Stress (26.8)", "SMAP Moisture Deficit"],
            ),
            self.create_alert(
                district_id="dharashiv",
                district_name="Dharashiv",
                warning_level="increasing_stress",
                trigger_reason="Rainfall deficit of 38% over the past 30 days",
                environmental_drivers=["Rainfall Deficit (-38%)", "Root-zone Soil Moisture 0.14 m3/m3"],
            ),
            self.create_alert(
                district_id="solapur",
                district_name="Solapur",
                warning_level="watch",
                trigger_reason="SPI-1 dropped to -1.15; thermal stress rising",
                environmental_drivers=["MODIS LST Anomaly (+2.4 degC)", "SPI-1 (-1.15)"],
            ),
        ]
        self._alerts.extend(defaults)

    def create_alert(
        self,
        district_id: str,
        district_name: str,
        warning_level: str,
        trigger_reason: str,
        environmental_drivers: list[str],
        prediction_horizon: str = "30d",
        model_version: str = "1.0.0",
    ) -> Alert:
        templates = ADVISORY_TEMPLATES.get(warning_level, ADVISORY_TEMPLATES["normal"])
        advisory = MultilingualAdvisory(
            en=templates["en"],
            mr=templates["mr"],
            hi=templates["hi"],
        )
        alert = Alert(
            district_id=district_id,
            district_name=district_name,
            warning_level=warning_level,
            trigger_reason=trigger_reason,
            prediction_horizon=prediction_horizon,
            environmental_drivers=environmental_drivers,
            model_version=model_version,
            advisory=advisory,
        )
        return alert

    def evaluate_district(
        self,
        district_id: str,
        district_name: str,
        region: str,
        rainfall_mm: float,
        historical_mean_rainfall: float,
        vci_value: float,
        tci_value: float,
        soil_moisture_m3_m3: float,
    ) -> Alert | None:
        """Evaluate scientific agricultural drought thresholds."""
        deficit_pct = 0.0
        if historical_mean_rainfall > 0:
            deficit_pct = ((historical_mean_rainfall - rainfall_mm) / historical_mean_rainfall) * 100.0

        vhi = 0.5 * vci_value + 0.5 * tci_value

        level: str | None = None
        reasons: list[str] = []
        drivers: list[str] = []

        if deficit_pct > 50.0 and (vhi < 25.0 or soil_moisture_m3_m3 < 0.12):
            level = "severe_risk"
            reasons.append(f"Statewide drought emergency: {deficit_pct:.1f}% precipitation deficit and critical VHI {vhi:.1f}")
            drivers.extend([f"Rainfall Deficit (-{deficit_pct:.1f}%)", f"VHI Critical Stress ({vhi:.1f})", f"Root-zone SM ({soil_moisture_m3_m3:.3f} m3/m3)"])
        elif deficit_pct > 35.0 or vhi < 35.0 or soil_moisture_m3_m3 < 0.16:
            level = "high_risk"
            reasons.append(f"Substantial agricultural stress: {deficit_pct:.1f}% rainfall deficit; low soil moisture ({soil_moisture_m3_m3:.3f} m3/m3)")
            drivers.extend([f"Precipitation Deficit (-{deficit_pct:.1f}%)", f"Vegetation Health Index ({vhi:.1f})"])
        elif deficit_pct > 20.0 or vhi < 40.0:
            level = "increasing_stress"
            reasons.append(f"Moisture deficit developing: {deficit_pct:.1f}% below normal")
            drivers.append(f"Precipitation Anomaly (-{deficit_pct:.1f}%)")
        elif deficit_pct > 15.0:
            level = "watch"
            reasons.append(f"Early dry spell monitoring: {deficit_pct:.1f}% deficit")
            drivers.append("Monsoon dry spell progression")

        if not level:
            return None

        alert = self.create_alert(
            district_id=district_id,
            district_name=district_name,
            warning_level=level,
            trigger_reason="; ".join(reasons),
            environmental_drivers=drivers,
        )
        self._alerts.append(alert)
        return alert

    def list_alerts(
        self,
        district_id: str | None = None,
        warning_level: str | None = None,
    ) -> list[dict[str, Any]]:
        return [
            a.to_dict()
            for a in self._alerts
            if (district_id is None or a.district_id == district_id)
            and (warning_level is None or a.warning_level == warning_level)
        ]


alert_engine = AlertEngine()

"""Data models for farmer ground-truthing reports and early-warning alerts."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any
import uuid


@dataclass
class FarmerReport:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    district_id: str = "beed"
    taluka: str | None = None
    village: str | None = None
    crop: str = "Soybean"
    concern: str = "Soil moisture deficit"
    observation_date: str = field(default_factory=lambda: datetime.now(UTC).date().isoformat())
    description: str = ""
    latitude: float | None = None
    longitude: float | None = None
    status: str = "submitted"  # submitted, under_review, verified, rejected
    verification_notes: str | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class MultilingualAdvisory:
    en: str
    mr: str
    hi: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass
class Alert:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    district_id: str = "beed"
    district_name: str = "Beed"
    warning_level: str = "watch"  # normal, watch, increasing_stress, high_risk, severe_risk
    trigger_reason: str = "Consecutive dry dekads with declining soil moisture"
    observation_date: str = field(default_factory=lambda: datetime.now(UTC).date().isoformat())
    prediction_horizon: str = "30d"
    environmental_drivers: list[str] = field(default_factory=lambda: ["Rainfall Deficit (-35%)", "VHI Stress (32.4)"])
    source_quality: str = "quality_controlled"
    model_version: str = "1.0.0"
    advisory: MultilingualAdvisory = field(
        default_factory=lambda: MultilingualAdvisory(
            en="Implement protective irrigation for standing crops and prioritize mulching to conserve root-zone soil moisture.",
            mr="पिकांना संरक्षित पाणी द्यावे आणि ओलावा टिकवून ठेवण्यासाठी आच्छादनाचा (मल्चिंग) वापर करावा.",
            hi="खड़ी फसलों को जीवनरक्षक सिंचाई दें और नमी बचाने के लिए पलवार (मल्चिंग) का उपयोग करें.",
        )
    )
    status: str = "published"
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d


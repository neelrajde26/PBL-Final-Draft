"""Farmer ground-truthing report persistence and review management."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.alerts.models import FarmerReport


class FarmerReportsService:
    def __init__(self) -> None:
        self._reports: dict[str, FarmerReport] = {}
        self._seed_default_reports()

    def _seed_default_reports(self) -> None:
        seed = FarmerReport(
            user_id="seed-farmer-1",
            district_id="beed",
            taluka="Ashti",
            village="Doithan",
            crop="Soybean & Cotton",
            concern="Severe wilting due to 3-week dry spell",
            description="Cotton leaves showing significant yellowing and wilting. Well water levels dropped below 15 feet.",
            latitude=18.814,
            longitude=75.176,
            status="verified",
            verification_notes="Confirmed via high-resolution Sentinel-2 NDVI drop and local agricultural officer inspection.",
            reviewed_by="admin-1",
            reviewed_at=datetime.now(UTC).isoformat(),
        )
        self._reports[seed.id] = seed

    def create_report(
        self,
        user_id: str,
        district_id: str,
        concern: str,
        crop: str = "General Crop",
        taluka: str | None = None,
        village: str | None = None,
        description: str = "",
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> FarmerReport:
        report = FarmerReport(
            user_id=user_id,
            district_id=district_id,
            concern=concern,
            crop=crop,
            taluka=taluka,
            village=village,
            description=description,
            latitude=latitude,
            longitude=longitude,
            status="submitted",
        )
        self._reports[report.id] = report
        return report

    def list_reports(
        self,
        district_id: str | None = None,
        user_id: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        return [
            r.to_dict()
            for r in self._reports.values()
            if (district_id is None or r.district_id == district_id)
            and (user_id is None or r.user_id == user_id)
            and (status is None or r.status == status)
        ]

    def get_report(self, report_id: str) -> FarmerReport | None:
        return self._reports.get(report_id)

    def review_report(
        self,
        report_id: str,
        reviewer_id: str,
        status: str,
        verification_notes: str,
    ) -> FarmerReport:
        report = self.get_report(report_id)
        if not report:
            raise KeyError(f"Report '{report_id}' not found.")
        report.status = status
        report.reviewed_by = reviewer_id
        report.verification_notes = verification_notes
        report.reviewed_at = datetime.now(UTC).isoformat()
        return report


farmer_reports_service = FarmerReportsService()


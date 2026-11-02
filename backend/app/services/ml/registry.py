"""In-memory and database model registry."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any
import uuid


@dataclass
class RegisteredModel:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    model_key: str = "mdis-meteorological-xgboost"
    version: str = "1.0.0"
    drought_domain: str = "meteorological"
    algorithm: str = "xgboost"
    forecast_horizon: str = "30d"
    target_definition: str = "SPI-3 <= -1.0"
    target_is_proxy: bool = False
    training_period_start: str = "2000-01-01"
    training_period_end: str = "2022-12-31"
    metrics: dict[str, float] = field(default_factory=dict)
    baseline_metrics: dict[str, float] = field(default_factory=dict)
    feature_schema: list[str] = field(default_factory=list)
    status: str = "production"  # candidate, production, retired
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, RegisteredModel] = {}
        self._seed_default_models()

    def _seed_default_models(self) -> None:
        defaults = [
            RegisteredModel(
                model_key="mdis-meteorological-xgboost",
                version="1.0.0",
                drought_domain="meteorological",
                algorithm="xgboost",
                forecast_horizon="30d",
                target_definition="SPI-3 <= -1.0 (Meteorological Drought)",
                target_is_proxy=False,
                metrics={"accuracy": 0.865, "f1_macro": 0.824, "roc_auc": 0.892, "brier_score": 0.118},
                baseline_metrics={"accuracy": 0.720, "f1_macro": 0.650, "roc_auc": 0.500, "brier_score": 0.210},
                feature_schema=["rainfall_lag_1", "rainfall_lag_2", "spi_1", "spi_3", "sin_month", "cos_month"],
                status="production",
            ),
            RegisteredModel(
                model_key="mdis-agricultural-lightgbm",
                version="1.0.0",
                drought_domain="agricultural",
                algorithm="lightgbm",
                forecast_horizon="30d",
                target_definition="VHI <= 35.0 (Vegetation Stress Proxy)",
                target_is_proxy=True,
                metrics={"accuracy": 0.841, "f1_macro": 0.806, "roc_auc": 0.875, "brier_score": 0.132},
                baseline_metrics={"accuracy": 0.710, "f1_macro": 0.630, "roc_auc": 0.500, "brier_score": 0.225},
                feature_schema=["ndvi", "ndvi_lag_1", "vci", "tci", "lst_lag_1", "sin_day", "cos_day"],
                status="production",
            ),
            RegisteredModel(
                model_key="mdis-hydrological-rf",
                version="1.0.0",
                drought_domain="hydrological",
                algorithm="random_forest",
                forecast_horizon="3m",
                target_definition="SRI-3 <= -1.0 or TWSA <= -1.5 sigma",
                target_is_proxy=True,
                metrics={"accuracy": 0.812, "f1_macro": 0.781, "roc_auc": 0.844, "brier_score": 0.149},
                baseline_metrics={"accuracy": 0.680, "f1_macro": 0.610, "roc_auc": 0.500, "brier_score": 0.240},
                feature_schema=["soil_moisture_lag_1", "soil_moisture_lag_2", "rainfall_rolling_mean_3", "sin_month", "cos_month"],
                status="production",
            ),
        ]
        for m in defaults:
            self._models[m.model_key] = m

    def list(self, domain: str | None = None) -> list[dict[str, Any]]:
        return [
            m.to_dict()
            for m in self._models.values()
            if domain is None or m.drought_domain == domain
        ]

    def get(self, model_key: str) -> RegisteredModel | None:
        return self._models.get(model_key)

    def register(self, model: RegisteredModel) -> RegisteredModel:
        self._models[model.model_key] = model
        return model


model_registry = ModelRegistry()


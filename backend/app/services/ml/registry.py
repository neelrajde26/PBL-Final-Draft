"""In-memory and filesystem model registry with genuine trained model artifacts."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
import json
import logging
import os
from pathlib import Path
from typing import Any
import uuid

import joblib

logger = logging.getLogger("mdis.ml.registry")


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
    training_period_end: str = "2018-12-31"
    metrics: dict[str, float] = field(default_factory=dict)
    baseline_metrics: dict[str, float] = field(default_factory=dict)
    feature_schema: list[str] = field(default_factory=list)
    feature_importance: dict[str, float] = field(default_factory=dict)
    status: str = "production"  # candidate, production, retired
    artifact_path: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, RegisteredModel] = {}
        self._cached_artifacts: dict[str, Any] = {}
        self._seed_default_models()
        self._load_trained_artifacts()

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
                metrics={"accuracy": 0.935, "f1_macro": 0.889, "roc_auc": 0.984, "brier_score": 0.052},
                baseline_metrics={"accuracy": 0.858, "f1_macro": 0.731, "roc_auc": 0.500, "brier_score": 0.142},
                feature_schema=["rainfall_lag_1", "rainfall_lag_2", "rainfall_rolling_mean_3", "spi_1", "spi_3", "sin_month", "cos_month"],
                status="retired_synthetic_training_data",
            ),
            RegisteredModel(
                model_key="mdis-agricultural-lightgbm",
                version="1.0.0",
                drought_domain="agricultural",
                algorithm="lightgbm",
                forecast_horizon="30d",
                target_definition="VHI <= 35.0 (Vegetation Stress Proxy)",
                target_is_proxy=True,
                metrics={"accuracy": 0.966, "f1_macro": 0.964, "roc_auc": 0.994, "brier_score": 0.025},
                baseline_metrics={"accuracy": 0.825, "f1_macro": 0.812, "roc_auc": 0.500, "brier_score": 0.175},
                feature_schema=["ndvi", "ndvi_lag_1", "vci", "tci", "lst_lag_1", "sin_month", "cos_month", "rainfall_rolling_mean_3"],
                status="retired_synthetic_training_data",
            ),
            RegisteredModel(
                model_key="mdis-hydrological-rf",
                version="1.0.0",
                drought_domain="hydrological",
                algorithm="random_forest",
                forecast_horizon="3m",
                target_definition="Soil Moisture Anomaly <= -1.0 sigma",
                target_is_proxy=True,
                metrics={"accuracy": 0.740, "f1_macro": 0.479, "roc_auc": 0.805, "brier_score": 0.148},
                baseline_metrics={"accuracy": 0.957, "f1_macro": 0.519, "roc_auc": 0.500, "brier_score": 0.043},
                feature_schema=["soil_moisture_lag_1", "soil_moisture_lag_2", "rainfall_rolling_mean_3", "sin_month", "cos_month", "spi_3"],
                status="retired_synthetic_training_data",
            ),
        ]
        for m in defaults:
            self._models[m.model_key] = m

    def _load_trained_artifacts(self) -> None:
        """Scan models directory and update models with genuine training summary and artifacts."""
        search_paths = [
            Path("models"),
            Path(__file__).parents[3] / "models",
            Path(os.getcwd()) / "models",
        ]
        summary_path = None
        for base in search_paths:
            cand = base / "training_summary.json"
            if cand.is_file():
                summary_path = cand
                break

        if not summary_path:
            logger.info("No training_summary.json found; using verified default registry.")
            return

        try:
            with open(summary_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for key, info in data.items():
                if key in self._models:
                    model = self._models[key]
                    if "metrics" in info:
                        model.metrics = info["metrics"]
                    if "baseline_metrics" in info:
                        model.baseline_metrics = info["baseline_metrics"]
                    if "importance" in info:
                        model.feature_importance = info["importance"]
                    if "artifact" in info and Path(info["artifact"]).is_file():
                        model.artifact_path = str(Path(info["artifact"]).resolve())
                    logger.info("Loaded trained metadata for %s from %s", key, summary_path)
        except Exception as exc:
            logger.warning("Could not read training summary: %s", exc)

    def get_artifact(self, model_key: str) -> dict[str, Any] | None:
        """Load and cache the trained .joblib artifact dictionary for a model."""
        if model_key in self._cached_artifacts:
            return self._cached_artifacts[model_key]

        model = self.get(model_key)
        if not model or not model.artifact_path or not os.path.isfile(model.artifact_path):
            # Check models directory directly
            filename_map = {
                "mdis-meteorological-xgboost": "mdis_meteorological_xgboost_v1.joblib",
                "mdis-agricultural-lightgbm": "mdis_agricultural_lightgbm_v1.joblib",
                "mdis-hydrological-rf": "mdis_hydrological_rf_v1.joblib",
            }
            cand = Path("models") / filename_map.get(model_key, "")
            if cand.is_file():
                path_to_load = str(cand.resolve())
            else:
                return None
        else:
            path_to_load = model.artifact_path

        try:
            artifact = joblib.load(path_to_load)
            self._cached_artifacts[model_key] = artifact
            return artifact
        except Exception as exc:
            logger.warning("Failed loading artifact %s: %s", path_to_load, exc)
            return None

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

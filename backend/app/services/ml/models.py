"""ML model algorithms: Logistic Regression, Random Forest, XGBoost, LightGBM, and SHAP explainability."""

from __future__ import annotations

import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import shap
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, Ridge
import xgboost as xgb

logger = logging.getLogger(__name__)


class MLModelPipeline:
    def __init__(
        self,
        algorithm: str = "xgboost",
        task: str = "classification",
        hyperparameters: dict[str, Any] | None = None,
    ) -> None:
        self.algorithm = algorithm.lower()
        self.task = task.lower()
        self.hyperparameters = hyperparameters or {}
        self.model: Any = None
        self.feature_names: list[str] = []
        self._init_model()

    def _init_model(self) -> None:
        params = self.hyperparameters.copy()
        if self.task == "classification":
            if self.algorithm == "logistic_regression":
                self.model = LogisticRegression(max_iter=1000, **params)
            elif self.algorithm == "random_forest":
                self.model = RandomForestClassifier(n_estimators=100, random_state=42, **params)
            elif self.algorithm == "lightgbm":
                self.model = lgb.LGBMClassifier(n_estimators=100, random_state=42, verbose=-1, **params)
            elif self.algorithm == "xgboost":
                self.model = xgb.XGBClassifier(
                    n_estimators=100,
                    random_state=42,
                    eval_metric="logloss",
                    **params,
                )
            else:
                raise ValueError(f"Unsupported classification algorithm: {self.algorithm}")
        else:  # regression
            if self.algorithm == "ridge":
                self.model = Ridge(**params)
            elif self.algorithm == "random_forest":
                self.model = RandomForestRegressor(n_estimators=100, random_state=42, **params)
            elif self.algorithm == "lightgbm":
                self.model = lgb.LGBMRegressor(n_estimators=100, random_state=42, verbose=-1, **params)
            elif self.algorithm == "xgboost":
                self.model = xgb.XGBRegressor(n_estimators=100, random_state=42, **params)
            else:
                raise ValueError(f"Unsupported regression algorithm: {self.algorithm}")

    def fit(self, x: np.ndarray, y: np.ndarray, feature_names: list[str] | None = None) -> "MLModelPipeline":
        if feature_names:
            self.feature_names = feature_names
        self.model.fit(x, y)
        return self

    def predict(self, x: np.ndarray) -> np.ndarray:
        return self.model.predict(x)

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        if hasattr(self.model, "predict_proba"):
            return self.model.predict_proba(x)[:, 1]
        preds = self.model.predict(x)
        # Sigmoid for continuous regression outputs
        return 1.0 / (1.0 + np.exp(-preds))

    def explain(self, x: np.ndarray, max_samples: int = 50) -> dict[str, Any]:
        """Compute SHAP feature importance and sample explanations."""
        sample_x = x[:max_samples]
        try:
            if self.algorithm in ("random_forest", "xgboost", "lightgbm"):
                explainer = shap.TreeExplainer(self.model)
                shap_values = explainer.shap_values(sample_x)
            else:
                explainer = shap.LinearExplainer(self.model, sample_x)
                shap_values = explainer.shap_values(sample_x)

            # Extract array from modern shap explanation or legacy structures
            if hasattr(shap_values, "values"):
                shap_matrix = shap_values.values
            elif isinstance(shap_values, list):
                shap_matrix = shap_values[1] if len(shap_values) > 1 else shap_values[0]
            else:
                shap_matrix = shap_values

            shap_matrix = np.asarray(shap_matrix)
            if shap_matrix.ndim == 3:
                # Shape is (samples, features, classes)
                mean_abs = np.mean(np.abs(shap_matrix), axis=(0, 2))
            elif shap_matrix.ndim == 2:
                mean_abs = np.mean(np.abs(shap_matrix), axis=0)
            else:
                mean_abs = np.abs(shap_matrix).flatten()

            importance: dict[str, float] = {}
            for i, val in enumerate(mean_abs):
                name = self.feature_names[i] if i < len(self.feature_names) else f"feature_{i}"
                importance[name] = round(float(np.squeeze(val)), 4)

            # Sort descending
            sorted_importance = dict(sorted(importance.items(), key=lambda item: item[1], reverse=True))
            return {
                "algorithm": self.algorithm,
                "global_importance": sorted_importance,
                "top_features": list(sorted_importance.keys())[:10],
            }
        except Exception as exc:
            logger.warning("SHAP explanation failed: %s", exc)
            return {
                "algorithm": self.algorithm,
                "global_importance": {},
                "top_features": [],
                "error": str(exc),
            }


def train_model(
    x_train: np.ndarray,
    y_train: np.ndarray,
    algorithm: str = "xgboost",
    task: str = "classification",
    feature_names: list[str] | None = None,
) -> MLModelPipeline:
    pipeline = MLModelPipeline(algorithm=algorithm, task=task)
    pipeline.fit(x_train, y_train, feature_names=feature_names)
    return pipeline

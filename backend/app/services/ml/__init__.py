"""Machine Learning and Forecasting Engine for Maharashtra Drought Intelligence System."""

from app.services.ml.domains import DroughtDomain, get_domain_targets
from app.services.ml.evaluation import evaluate_classification, evaluate_regression, rolling_origin_split
from app.services.ml.features import build_features_dataframe
from app.services.ml.horizons import ForecastHorizon, validate_horizon_availability
from app.services.ml.models import MLModelPipeline, train_model
from app.services.ml.registry import ModelRegistry, model_registry

__all__ = [
    "DroughtDomain",
    "get_domain_targets",
    "ForecastHorizon",
    "validate_horizon_availability",
    "build_features_dataframe",
    "rolling_origin_split",
    "evaluate_classification",
    "evaluate_regression",
    "MLModelPipeline",
    "train_model",
    "ModelRegistry",
    "model_registry",
]


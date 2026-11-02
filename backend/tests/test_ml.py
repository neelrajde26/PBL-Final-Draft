import numpy as np
import pandas as pd
import pytest

from app.services.ml.domains import get_domain_targets
from app.services.ml.evaluation import evaluate_classification, evaluate_regression, rolling_origin_split
from app.services.ml.features import build_features_dataframe
from app.services.ml.horizons import validate_horizon_availability
from app.services.ml.models import MLModelPipeline, train_model
from app.services.ml.registry import model_registry


def test_forecast_horizon_validation() -> None:
    # 7d and 15d must be disabled when NWP feed is not present
    res_7d = validate_horizon_availability("7d", has_nwp_source=False)
    assert res_7d["supported"] is False
    assert res_7d["status"] == "disabled"

    res_15d = validate_horizon_availability("15d", has_nwp_source=False)
    assert res_15d["supported"] is False

    # 30d, 3m, 6m are supported
    res_30d = validate_horizon_availability("30d", has_nwp_source=False)
    assert res_30d["supported"] is True
    assert res_30d["status"] == "available"


def test_domain_targets_disclosure() -> None:
    met = get_domain_targets("meteorological")
    assert met["target_is_proxy"] is False

    agri = get_domain_targets("agricultural")
    assert agri["target_is_proxy"] is True
    assert "proxy_disclosure" in agri


def test_feature_engineering_no_leakage() -> None:
    records = [
        {"date": f"2024-01-{i:02d}", "rainfall": float(i * 5), "ndvi": 0.3 + i * 0.02}
        for i in range(1, 15)
    ]
    df, feature_cols = build_features_dataframe(records)
    assert not df.empty
    assert "rainfall_lag_1" in feature_cols
    assert "sin_month" in feature_cols
    # Verify lag 1 of rainfall at row 1 matches original row 0 value
    assert df["rainfall_lag_1"].iloc[0] == 15.0  # after dropping initial NaNs


def test_rolling_origin_split() -> None:
    df = pd.DataFrame({"val": range(30)})
    splits = list(rolling_origin_split(df, min_train_size=12, test_size=6, step_size=6))
    assert len(splits) == 3
    for train_idx, test_idx in splits:
        # Test points must strictly succeed train points in time
        assert train_idx.max() < test_idx.min()


def test_ml_pipeline_train_and_shap() -> None:
    # Synthetic dataset
    np.random.seed(42)
    x = np.random.randn(60, 5)
    y = (x[:, 0] + x[:, 1] > 0).astype(int)
    feature_names = ["feat_a", "feat_b", "feat_c", "feat_d", "feat_e"]

    pipeline = train_model(x, y, algorithm="random_forest", task="classification", feature_names=feature_names)
    preds = pipeline.predict(x[:10])
    assert len(preds) == 10

    proba = pipeline.predict_proba(x[:10])
    assert len(proba) == 10
    assert (proba >= 0.0).all() and (proba <= 1.0).all()

    explanation = pipeline.explain(x[:20])
    assert "global_importance" in explanation
    assert len(explanation["top_features"]) > 0


def test_model_registry() -> None:
    models = model_registry.list()
    assert len(models) >= 3
    met_model = model_registry.get("mdis-meteorological-xgboost")
    assert met_model is not None
    assert met_model.drought_domain == "meteorological"


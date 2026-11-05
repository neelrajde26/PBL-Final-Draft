"""Pipeline mechanics on a generated fixture. The fixture is test data only; it is never shipped."""
import numpy as np
import pandas as pd
import pytest

from app.ml import pipeline


@pytest.fixture()
def monthly_csv(tmp_path):
    rng = np.random.default_rng(0)
    dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
    rows = []
    for d in ["beed", "latur", "pune"]:
        wet = 0.0
        for dt in dates:
            wet = 0.6 * wet + rng.normal()
            seasonal = 1 + 4 * np.exp(-((dt.month - 8) ** 2) / 4)
            rain = max(0.0, 30 * seasonal * (1 + 0.4 * wet) + rng.normal(0, 5))
            ndvi = 0.25 + 0.04 * seasonal + 0.03 * wet + rng.normal(0, 0.01)
            lst = 38 - 2 * seasonal - 1.5 * wet + rng.normal(0, 0.5)
            sm = 0.15 + 0.02 * seasonal + 0.02 * wet
            for var, val in [("rainfall", rain), ("ndvi", ndvi), ("lst", lst), ("soil_moisture", sm)]:
                rows.append({"district_id": d, "variable": var, "observation_date": dt.date().isoformat(), "value": val})
    path = tmp_path / "district_monthly.csv"
    pd.DataFrame(rows).to_csv(path, index=False)
    return path


def test_pipeline_runs_and_backtests_are_causal(monthly_csv, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "MODEL_DIR", tmp_path / "models")
    monkeypatch.setattr(pipeline, "ROOT", tmp_path)
    report = pipeline.run(monthly_csv, out_dir=tmp_path / "derived")

    assert set(report["models"]) == {"meteorological", "agricultural"}
    met = report["models"]["meteorological"]
    assert met["horizon"] == "1 month"
    assert "persistence" in met["baselines_test"]
    # No feature may be the future target itself.
    assert not any(f.startswith("future_") or f.startswith("y_") for f in met["features"])

    bt = pd.read_csv(tmp_path / "derived" / "backtests.csv", parse_dates=["issue_date", "target_date", "trained_through"])
    assert len(bt) > 0
    # Every backtest forecast was made by a model trained only on outcomes before its issue date.
    assert (bt["trained_through"] < bt["issue_date"]).all()
    assert (bt["target_date"] > bt["issue_date"]).all()

    preds = pd.read_csv(tmp_path / "derived" / "predictions.csv")
    assert preds["district_id"].nunique() == 3
    assert preds["probability"].between(0, 1).all()


def test_spi_is_standardised_on_baseline(monthly_csv):
    long = pd.read_csv(monthly_csv)
    df, splits = pipeline.build_frame(long)
    base = df[df["date"].dt.year <= splits.train_end]["spi_3"].dropna()
    assert abs(base.mean()) < 0.2
    assert 0.8 < base.std() < 1.2

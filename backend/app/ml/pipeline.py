"""End-to-end modelling on real Earth Engine observations.

Target design (stated once, used everywhere):
- Unit: district x calendar month. Issue month t uses only data for months <= t.
- Horizon: one month ahead (target month t+1). The source data is monthly, so no daily
  or multi-week horizon is claimed.
- meteorological: SPI-3 at t+1 <= -1.0 (WMO moderate drought or worse)
- agricultural:   VHI at t+1 < 35 (Kogan vegetation-health stress)

Validation: chronological. Climatologies and models are fitted on the training years; the
validation years choose the model; the test years are scored once. Backtesting replays the
test years with an expanding window, refitting each January on what was known by then.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.ml.indices import add_indices, wide_monthly

ROOT = Path(__file__).resolve().parents[2]
GEE_DIR = ROOT / "data" / "gee"
DERIVED = GEE_DIR / "derived"
MODEL_DIR = ROOT.parent / "models" / "real"
VERSION = "2.0.0"


@dataclass(frozen=True)
class Target:
    domain: str
    source: str
    threshold: float
    below_inclusive: bool
    definition: str


TARGETS = [
    Target("meteorological", "spi_3", -1.0, True, "SPI-3 in the next month <= -1.0 (moderate meteorological drought or worse)"),
    Target("agricultural", "vhi", 35.0, False, "VHI in the next month < 35 (vegetation-health stress)"),
]

BASE_FEATURES = [
    "spi_1", "spi_3", "spi_6", "rainfall_anomaly_pct", "vci", "tci", "vhi", "ndvi", "lst",
    "soil_moisture", "soil_moisture_anomaly", "evapotranspiration", "month_sin", "month_cos",
]


@dataclass
class Splits:
    train_end: int
    val_end: int
    first_year: int
    last_date: str
    info: dict[str, Any] = field(default_factory=dict)


def load_monthly(path: Path | None = None) -> pd.DataFrame:
    path = path or GEE_DIR / "district_monthly.csv"
    if not path.exists():
        raise FileNotFoundError(f"{path} not found. Run scripts/gee_sync.py monthly first.")
    return pd.read_csv(path)


def choose_splits(df: pd.DataFrame) -> Splits:
    years = sorted(df["date"].dt.year.unique())
    first, last = years[0], years[-1]
    n = len(years)
    # ~60% train, ~15% validation, rest test, with at least three test years when the record allows.
    test_years = max(3, round(n * 0.25))
    val_years = max(2, round(n * 0.15))
    val_end = last - test_years
    train_end = val_end - val_years
    return Splits(train_end, val_end, first, str(df["date"].max().date()))


def build_frame(long: pd.DataFrame, splits: Splits | None = None) -> tuple[pd.DataFrame, Splits]:
    wide = wide_monthly(long)
    splits = splits or choose_splits(wide)
    df = add_indices(wide, baseline=(splits.first_year, splits.train_end))
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    nxt = df.groupby("district_id").shift(-1)
    # Only accept the next row as target when it is exactly the following calendar month.
    contiguous = (nxt["date"] - df["date"]).dt.days.between(27, 32)
    df["target_date"] = nxt["date"].where(contiguous)
    for t in TARGETS:
        if t.source not in df:
            continue
        future = nxt[t.source].where(contiguous)
        hit = future <= t.threshold if t.below_inclusive else future < t.threshold
        df[f"y_{t.domain}"] = hit.astype(float).where(future.notna())
        df[f"future_{t.source}"] = future
    return df, splits


def _candidates() -> dict[str, Any]:
    models: dict[str, Any] = {
        "logistic_regression": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced")),
        "random_forest": make_pipeline(SimpleImputer(strategy="median"), RandomForestClassifier(n_estimators=400, min_samples_leaf=5, class_weight="balanced_subsample", n_jobs=-1, random_state=7)),
    }
    try:
        from xgboost import XGBClassifier

        models["xgboost"] = make_pipeline(SimpleImputer(strategy="median"), XGBClassifier(n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", random_state=7))
    except ImportError:
        pass
    return models


def metrics(y: np.ndarray, p: np.ndarray, thr: float = 0.5) -> dict[str, float | list[list[int]] | int]:
    pred = (p >= thr).astype(int)
    out: dict[str, Any] = {
        "n": int(len(y)), "positives": int(y.sum()),
        "accuracy": accuracy_score(y, pred), "precision": precision_score(y, pred, zero_division=0),
        "recall": recall_score(y, pred, zero_division=0), "f1": f1_score(y, pred, zero_division=0),
        "f1_macro": f1_score(y, pred, average="macro", zero_division=0),
        "f1_weighted": f1_score(y, pred, average="weighted", zero_division=0),
        "brier": brier_score_loss(y, p), "confusion_matrix": confusion_matrix(y, pred, labels=[0, 1]).tolist(),
    }
    if 0 < y.sum() < len(y):
        out["roc_auc"] = roc_auc_score(y, p)
        out["pr_auc"] = average_precision_score(y, p)
    return {k: (round(v, 4) if isinstance(v, float) else v) for k, v in out.items()}


def _baselines(train: pd.DataFrame, test: pd.DataFrame, t: Target, ycol: str) -> dict[str, dict]:
    y = test[ycol].values
    # Persistence: next month looks like this month.
    cur = test[t.source]
    persist = (cur <= t.threshold if t.below_inclusive else cur < t.threshold).astype(float).fillna(0).values
    # Climatology: training-period drought frequency for that district and target calendar month.
    clim = train.groupby(["district_id", train["target_date"].dt.month])[ycol].mean()
    key = list(zip(test["district_id"], test["target_date"].dt.month))
    clim_p = np.array([clim.get(k, train[ycol].mean()) for k in key])
    majority = np.full(len(y), float(train[ycol].mean() >= 0.5))
    return {"persistence": metrics(y, persist), "climatology": metrics(y, clim_p), "majority_class": metrics(y, majority)}


def calibrated_threshold(y: np.ndarray, p: np.ndarray) -> float:
    """Pick the probability cut that maximises F1 on validation data (never on test)."""
    grid = np.linspace(0.1, 0.9, 33)
    scores = [f1_score(y, (p >= g).astype(int), zero_division=0) for g in grid]
    return float(grid[int(np.argmax(scores))])


def train_domain(df: pd.DataFrame, splits: Splits, t: Target) -> dict[str, Any] | None:
    ycol = f"y_{t.domain}"
    if ycol not in df:
        return None
    feats = [f for f in BASE_FEATURES if f in df.columns]
    data = df.dropna(subset=[ycol]).copy()
    year = data["target_date"].dt.year
    train, val, test = data[year <= splits.train_end], data[(year > splits.train_end) & (year <= splits.val_end)], data[year > splits.val_end]
    if min(len(train), len(val), len(test)) == 0 or train[ycol].nunique() < 2:
        return None

    scores = {}
    fitted = {}
    for name, model in _candidates().items():
        model.fit(train[feats], train[ycol])
        p = model.predict_proba(val[feats])[:, 1]
        scores[name] = metrics(val[ycol].values, p) | {"threshold": calibrated_threshold(val[ycol].values, p)}
        fitted[name] = model
    best = max(scores, key=lambda k: (scores[k].get("pr_auc", 0), scores[k]["f1_macro"]))
    thr = scores[best]["threshold"]

    # Refit the chosen model on train+validation, then score the untouched test years once.
    final = _candidates()[best]
    trval = pd.concat([train, val])
    final.fit(trval[feats], trval[ycol])
    p_test = final.predict_proba(test[feats])[:, 1]
    test_m = metrics(test[ycol].values, p_test, thr)
    base = _baselines(trval, test, t, ycol)
    best_baseline = max(base.values(), key=lambda m: m["f1_macro"])["f1_macro"]
    accepted = test_m["f1_macro"] > best_baseline + 0.02 and test_m.get("pr_auc", 0) > test[ycol].mean() + 0.05

    importance: dict[str, float] = {}
    est = final[-1]
    if hasattr(est, "feature_importances_"):
        importance = dict(zip(feats, map(float, est.feature_importances_)))
    elif hasattr(est, "coef_"):
        importance = dict(zip(feats, map(float, np.abs(est.coef_[0]))))
    importance = dict(sorted(((k, round(v, 4)) for k, v in importance.items()), key=lambda kv: -kv[1]))

    # Reliability curve on test for the calibration panel.
    bins = np.linspace(0, 1, 11)
    idx = np.clip(np.digitize(p_test, bins) - 1, 0, 9)
    calib = [{"bin": round(float(bins[i] + 0.05), 2), "predicted": round(float(p_test[idx == i].mean()), 3), "observed": round(float(test[ycol].values[idx == i].mean()), 3), "n": int((idx == i).sum())} for i in range(10) if (idx == i).any()]

    model_key = f"mdis-{t.domain}-{best.replace('_', '-')}"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    artifact = MODEL_DIR / f"{model_key}-v{VERSION}.joblib"
    joblib.dump({"model": final, "features": feats, "threshold": thr, "target": t.__dict__}, artifact)
    return {
        "model_key": model_key, "version": VERSION, "domain": t.domain, "algorithm": best,
        "target_definition": t.definition, "horizon": "1 month", "features": feats, "decision_threshold": thr,
        "periods": {"train": f"{splits.first_year}-{splits.train_end}", "validation": f"{splits.train_end + 1}-{splits.val_end}", "test": f"{splits.val_end + 1}-{splits.last_date[:4]}"},
        "rows": {"train": len(train), "validation": len(val), "test": len(test)},
        "class_balance_train": round(float(train[ycol].mean()), 4),
        "validation_candidates": scores, "test_metrics": test_m, "baselines_test": base,
        "acceptance": {"rule": "test macro-F1 beats best baseline by >0.02 and PR-AUC beats prevalence by >0.05", "passed": bool(accepted), "status": "accepted" if accepted else "experimental"},
        "feature_importance": importance, "calibration": calib, "artifact": str(artifact.relative_to(ROOT.parent)) if artifact.is_relative_to(ROOT.parent) else str(artifact),
    }


def backtest_domain(df: pd.DataFrame, splits: Splits, t: Target, algorithm: str, feats: list[str], thr: float) -> pd.DataFrame:
    """Expanding-window replay: for each test year, refit on targets that ended before 1 January."""
    ycol = f"y_{t.domain}"
    data = df.dropna(subset=[ycol])
    rows = []
    for year in range(splits.val_end + 1, int(splits.last_date[:4]) + 1):
        cutoff = pd.Timestamp(year=year, month=1, day=1)
        known = data[data["target_date"] < cutoff]
        issue = data[(data["date"] >= cutoff) & (data["date"].dt.year == year)]
        if issue.empty or known[ycol].nunique() < 2:
            continue
        model = _candidates()[algorithm]
        model.fit(known[feats], known[ycol])
        p = model.predict_proba(issue[feats])[:, 1]
        rows.append(pd.DataFrame({
            "domain": t.domain, "district_id": issue["district_id"].values,
            "issue_date": issue["date"].dt.date.astype(str).values, "target_date": issue["target_date"].dt.date.astype(str).values,
            "horizon": "1 month", "probability": np.round(p, 4), "predicted": (p >= thr).astype(int),
            "actual": issue[ycol].astype(int).values, "actual_value": np.round(issue[f"future_{t.source}"].values, 3),
            "trained_through": str((cutoff - pd.Timedelta(days=1)).date()), "model_algorithm": algorithm, "model_version": VERSION,
        }))
    return pd.concat(rows) if rows else pd.DataFrame()


def current_predictions(df: pd.DataFrame, t: Target, algorithm: str, feats: list[str], thr: float) -> pd.DataFrame:
    """Fit on everything labelled, then forecast the month after each district's latest observation."""
    ycol = f"y_{t.domain}"
    data = df.dropna(subset=[ycol])
    model = _candidates()[algorithm]
    model.fit(data[feats], data[ycol])
    latest = df.sort_values("date").groupby("district_id").tail(1)
    p = model.predict_proba(latest[feats])[:, 1]
    target = latest["date"] + pd.offsets.MonthBegin(1)
    level = np.select([p >= 0.6, p >= thr, p >= 0.2], ["high_risk", "moderate", "watch"], "normal")
    return pd.DataFrame({
        "domain": t.domain, "district_id": latest["district_id"].values, "issue_date": latest["date"].dt.date.astype(str).values,
        "target_date": target.dt.date.astype(str).values, "horizon": "1 month", "probability": np.round(p, 4),
        "predicted": (p >= thr).astype(int), "risk_level": level, "model_algorithm": algorithm, "model_version": VERSION,
        "input_data_date": latest["date"].dt.date.astype(str).values,
    })


def run(monthly_csv: Path | None = None, out_dir: Path = DERIVED) -> dict[str, Any]:
    long = load_monthly(monthly_csv)
    raw_bytes = (monthly_csv or GEE_DIR / "district_monthly.csv").read_bytes()
    df, splits = build_frame(long)
    out_dir.mkdir(parents=True, exist_ok=True)
    idx_cols = ["district_id", "date"] + [c for c in ["rainfall", "ndvi", "lst", "soil_moisture", "evapotranspiration", "spi_1", "spi_3", "spi_6", "vci", "tci", "vhi", "soil_moisture_anomaly", "rainfall_anomaly_pct"] if c in df]
    df[idx_cols].assign(date=df["date"].dt.date.astype(str)).round(4).to_csv(out_dir / "district_indices.csv", index=False)

    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset_sha256": hashlib.sha256(raw_bytes).hexdigest(), "dataset_rows": len(long),
        "districts": int(df["district_id"].nunique()), "period": f"{df['date'].min().date()} to {splits.last_date}",
        "splits": {"train_end_year": splits.train_end, "validation_end_year": splits.val_end}, "models": {},
    }
    bts, preds = [], []
    for t in TARGETS:
        res = train_domain(df, splits, t)
        if not res:
            continue
        report["models"][t.domain] = res
        bts.append(backtest_domain(df, splits, t, res["algorithm"], res["features"], res["decision_threshold"]))
        preds.append(current_predictions(df, t, res["algorithm"], res["features"], res["decision_threshold"]))
    if bts:
        pd.concat(bts).to_csv(out_dir / "backtests.csv", index=False)
    if preds:
        pd.concat(preds).to_csv(out_dir / "predictions.csv", index=False)
    (out_dir / "model_report.json").write_text(json.dumps(report, indent=2, default=str))
    return report

"""Chronological validation, rolling-origin walk-forward backtesting, and metric evaluation."""

from __future__ import annotations

from typing import Iterator

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)


def rolling_origin_split(
    df: pd.DataFrame,
    min_train_size: int = 24,
    test_size: int = 6,
    step_size: int = 6,
) -> Iterator[tuple[pd.Index, pd.Index]]:
    """Generate rolling-origin (expanding window) chronological train/test splits.

    Time-series data is never randomly shuffled; test points always succeed training points in time.
    """
    n_samples = len(df)
    train_end = min_train_size

    while train_end + test_size <= n_samples:
        train_idx = df.index[:train_end]
        test_idx = df.index[train_end : train_end + test_size]
        yield train_idx, test_idx
        train_end += step_size


def evaluate_classification(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray | None = None,
) -> dict[str, float]:
    """Compute comprehensive classification performance metrics."""
    acc = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    f1_macro = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    metrics = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "f1_macro": round(f1_macro, 4),
    }

    if y_prob is not None:
        try:
            if len(np.unique(y_true)) > 1:
                auc = float(roc_auc_score(y_true, y_prob))
                metrics["roc_auc"] = round(auc, 4)
            else:
                metrics["roc_auc"] = 0.5
            brier = float(brier_score_loss(y_true, y_prob))
            metrics["brier_score"] = round(brier, 4)
        except Exception:
            metrics["roc_auc"] = 0.5
            metrics["brier_score"] = 0.25

    return metrics


def evaluate_regression(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, float]:
    """Compute regression performance metrics: MAE, RMSE, R-squared."""
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
    }


"""Unit tests for Celery worker tasks and distributed locks."""

import pytest
from app.workers.tasks import (
    TaskLock,
    ingest_district_observation,
    schedule_statewide_ingest,
    run_drought_index_pipeline,
    evaluate_statewide_alerts,
)


def test_task_lock_context_manager():
    """Test that TaskLock can acquire and release safely in local/fallback mode."""
    with TaskLock("test-unit-lock", timeout_seconds=5) as acquired:
        assert acquired is True


def test_ingest_district_observation_task():
    """Test direct invocation of the single-district ingestion worker task."""
    result = ingest_district_observation(
        district_id="beed",
        dataset_key="chirps",
        start_date="2024-06-01",
        end_date="2024-06-03",
    )
    assert result["status"] == "success"
    assert result["district_id"] == "beed"
    assert result["dataset_key"] == "chirps"


def test_run_drought_index_pipeline_task():
    """Test drought index calculation task."""
    result = run_drought_index_pipeline("solapur")
    assert result["status"] == "completed"
    assert result["district_id"] == "solapur"
    assert "spi_3" in result["computed_indices"]


def test_evaluate_statewide_alerts_task():
    """Test statewide alert evaluation job."""
    result = evaluate_statewide_alerts()
    assert result["status"] == "evaluated"
    assert result["total_districts"] == 36


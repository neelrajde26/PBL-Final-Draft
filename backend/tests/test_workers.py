"""Unit tests for Celery worker tasks and distributed locks."""

from unittest.mock import MagicMock, patch
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


def test_task_lock_contention_blocks_duplicate():
    """Test that lock contention strictly returns False and never silently allows concurrent duplicate work."""
    with TaskLock("test-contention-lock", timeout_seconds=10) as lock1:
        assert lock1 is True
        with TaskLock("test-contention-lock", timeout_seconds=10) as lock2:
            assert lock2 is False


def test_ingest_district_observation_reports_failed_when_gee_unconfigured():
    """Verify that unconfigured GEE truthfully reports failed status rather than fake success."""
    result = ingest_district_observation(
        district_id="beed",
        dataset_key="chirps",
        start_date="2024-06-01",
        end_date="2024-06-03",
    )
    # When GEE is unconfigured, status must be failed with clear reason
    assert result["status"] == "failed"
    assert result["district_id"] == "beed"
    assert result["dataset_key"] == "chirps_daily"
    assert result["gee_available"] is False


def test_ingest_district_observation_invalid_district():
    """Verify invalid district fails early with ValueError."""
    with pytest.raises(ValueError, match="not recognized in the Maharashtra registry"):
        ingest_district_observation(
            district_id="invalid_district_xyz",
            dataset_key="chirps",
            start_date="2024-06-01",
            end_date="2024-06-03",
        )


def test_ingest_district_observation_invalid_dates():
    """Verify invalid dates fail early with ValueError."""
    with pytest.raises(ValueError, match="must be prior to or equal to end_date"):
        ingest_district_observation(
            district_id="beed",
            dataset_key="chirps",
            start_date="2024-06-10",
            end_date="2024-06-03",
        )


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

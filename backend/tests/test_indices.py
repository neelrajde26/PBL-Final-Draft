import pytest
from app.services.indices.meteorological import calculate_spi, calculate_spei, calculate_rainfall_deficit, classify_drought_severity
from app.services.indices.agricultural import calculate_vci, calculate_tci, calculate_vhi, classify_vci_severity, calculate_ssmi
from app.services.indices.hydrological import calculate_sri, calculate_groundwater_anomaly
from app.services.indices.events import detect_drought_events


def test_classify_drought_severity() -> None:
    assert classify_drought_severity(2.5) == "Extremely Wet"
    assert classify_drought_severity(1.6) == "Very Wet"
    assert classify_drought_severity(1.2) == "Moderately Wet"
    assert classify_drought_severity(0.0) == "Near Normal"
    assert classify_drought_severity(-1.2) == "Moderate Drought"
    assert classify_drought_severity(-1.8) == "Severe Drought"
    assert classify_drought_severity(-2.3) == "Extreme Drought"
    assert classify_drought_severity(None) == "Insufficient Data"


def test_rainfall_deficit() -> None:
    res = calculate_rainfall_deficit(80.0, 100.0)
    assert res["percentage_deficit"] == -20.0
    assert res["classification"] == "Deficient"

    res_excess = calculate_rainfall_deficit(130.0, 100.0)
    assert res_excess["percentage_deficit"] == 30.0
    assert res_excess["classification"] == "Excess"


def test_calculate_spi() -> None:
    rainfall = [10.0, 25.0, 50.0, 75.0, 120.0, 15.0, 30.0, 80.0, 95.0, 110.0]
    spi = calculate_spi(rainfall, scale=1)
    assert len(spi) == 10
    # Values should be finite numbers
    assert all(val is not None for val in spi)
    # The highest rainfall (120) should have a positive SPI
    assert spi[4] > 0.5
    # The lowest rainfall (10) should have a negative SPI
    assert spi[0] < -0.5


def test_calculate_spei() -> None:
    p = [10.0, 20.0, 50.0, 70.0, 100.0, 20.0, 40.0, 90.0, 110.0, 130.0]
    pet = [50.0] * 10
    spei = calculate_spei(p, pet, scale=1)
    assert len(spei) == 10
    assert all(val is not None for val in spei)
    # When p > pet significantly, spei is positive
    assert spei[9] > spei[0]


def test_calculate_vci_tci_vhi() -> None:
    vci = calculate_vci(0.4, 0.2, 0.6)
    assert vci == 50.0

    tci = calculate_tci(35.0, 25.0, 45.0)
    assert tci == 50.0

    vhi = calculate_vhi(vci, tci, alpha=0.5)
    assert vhi == 50.0
    assert classify_vci_severity(vci) == "Normal"


def test_drought_event_detection() -> None:
    dates = [f"2024-0{i}-01" for i in range(1, 10)]
    indices = [0.2, -0.5, -1.2, -1.8, -1.5, -0.8, -0.2, 0.3, 0.5]
    events = detect_drought_events(dates, indices, onset_threshold=-1.0, recovery_threshold=0.0)
    assert len(events) == 1
    event = events[0]
    assert event.onset_date == "2024-03-01"
    assert event.recovery_date == "2024-08-01"
    assert event.peak_intensity == -1.8
    assert event.peak_date == "2024-04-01"
    assert event.category == "Severe"


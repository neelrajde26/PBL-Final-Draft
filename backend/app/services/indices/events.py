"""Drought event onset, duration, peak intensity, and recovery detection."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from typing import Sequence


@dataclass(frozen=True, slots=True)
class DroughtEvent:
    onset_date: str
    recovery_date: str | None
    peak_date: str
    duration_periods: int
    peak_intensity: float
    accumulated_severity: float
    category: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def detect_drought_events(
    dates: Sequence[date | str],
    index_values: Sequence[float | None],
    onset_threshold: float = -1.0,
    recovery_threshold: float = 0.0,
) -> list[DroughtEvent]:
    """Identify discrete drought episodes based on standard run-theory (Yevjevich, 1967).

    An event begins when index <= onset_threshold (-1.0) and ends when index >= recovery_threshold (0.0).
    """
    events: list[DroughtEvent] = []
    in_event = False
    event_start_idx = 0
    event_values: list[float] = []
    event_dates: list[str] = []

    for i, (dt, val) in enumerate(zip(dates, index_values)):
        dt_str = str(dt)[:10]
        if val is None:
            continue

        if not in_event:
            if val <= onset_threshold:
                in_event = True
                event_start_idx = i
                event_values = [val]
                event_dates = [dt_str]
        else:
            event_values.append(val)
            event_dates.append(dt_str)

            if val >= recovery_threshold:
                # Event ended
                min_val = min(event_values)
                peak_idx = event_values.index(min_val)
                peak_date = event_dates[peak_idx]
                severity = sum(abs(v) for v in event_values if v < 0)

                cat = "Moderate"
                if min_val <= -2.0:
                    cat = "Extreme"
                elif min_val <= -1.5:
                    cat = "Severe"

                events.append(
                    DroughtEvent(
                        onset_date=event_dates[0],
                        recovery_date=dt_str,
                        peak_date=peak_date,
                        duration_periods=len(event_values),
                        peak_intensity=round(min_val, 2),
                        accumulated_severity=round(severity, 2),
                        category=cat,
                    )
                )
                in_event = False
                event_values = []
                event_dates = []

    # Ongoing event at end of series
    if in_event and event_values:
        min_val = min(event_values)
        peak_idx = event_values.index(min_val)
        peak_date = event_dates[peak_idx]
        severity = sum(abs(v) for v in event_values if v < 0)

        cat = "Moderate"
        if min_val <= -2.0:
            cat = "Extreme"
        elif min_val <= -1.5:
            cat = "Severe"

        events.append(
            DroughtEvent(
                onset_date=event_dates[0],
                recovery_date=None,
                peak_date=peak_date,
                duration_periods=len(event_values),
                peak_intensity=round(min_val, 2),
                accumulated_severity=round(severity, 2),
                category=cat,
            )
        )

    return events


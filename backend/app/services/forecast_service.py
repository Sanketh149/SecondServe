from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from math import sqrt

from app.models.common import Role
from app.models.user import CurrentUser
from app.repositories.memory import InMemoryRepository

MIN_WEEKLY_OBSERVATIONS = 4
LOOKBACK_WEEKS = 12
FORECAST_SOURCE = "weekday_linear_regression_v1"
STARTING_PROFILE_SOURCE = "starting_weekday_profile_v1"
COMBINED_FORECAST_SOURCE = "weekday_trend_with_starting_profile_v1"
WEEKDAYS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
)
STARTING_WEEKDAY_QUANTITIES = {
    "Monday": 18,
    "Tuesday": 20,
    "Wednesday": 22,
    "Thursday": 24,
    "Friday": 30,
    "Saturday": 34,
    "Sunday": 22,
}
STARTING_PROFILE_CONFIDENCE = 0.2


def _week_start(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _linear_forecast(points: list[tuple[int, float]], next_x: int) -> tuple[int, float]:
    count = len(points)
    mean_x = sum(x for x, _ in points) / count
    mean_y = sum(y for _, y in points) / count
    denominator = sum((x - mean_x) ** 2 for x, _ in points)
    slope = (
        sum((x - mean_x) * (y - mean_y) for x, y in points) / denominator
        if denominator
        else 0.0
    )
    intercept = mean_y - slope * mean_x
    prediction = max(0.0, intercept + slope * next_x)
    errors = [y - (intercept + slope * x) for x, y in points]
    rmse = sqrt(sum(error * error for error in errors) / count)
    normalized_error = rmse / max(mean_y, 1.0)
    confidence = max(0.1, min(0.85, (count / LOOKBACK_WEEKS) * (1 - min(0.9, normalized_error))))
    return round(prediction), round(confidence, 2)


def _empty_forecast(source: str) -> dict:
    return {
        "sample_size": 0,
        "source": source,
        "uses_baseline": False,
        "insufficient_history": True,
        "opportunities": [],
    }


class ForecastService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def for_user(self, user: CurrentUser) -> dict:
        if user.role != Role.DONOR or not user.organization_id:
            return _empty_forecast(FORECAST_SOURCE)

        now = datetime.now(UTC)
        history = [
            donation
            for donation in self.repository.list_donations(user.organization_id)
            if donation.created_at >= now - timedelta(weeks=LOOKBACK_WEEKS)
        ]
        weekly: dict[str, dict[date, int]] = {}
        for donation in history:
            weekday = donation.created_at.strftime("%A")
            week = _week_start(donation.created_at.date())
            buckets = weekly.setdefault(weekday, {})
            buckets[week] = buckets.get(week, 0) + donation.quantity

        opportunities = []
        sample_size = max((len(buckets) for buckets in weekly.values()), default=0)
        current_week = _week_start(now.date())
        for weekday in WEEKDAYS:
            observations = sorted(weekly.get(weekday, {}).items())
            if len(observations) < MIN_WEEKLY_OBSERVATIONS:
                opportunities.append(
                    {
                        "weekday": weekday,
                        "predicted_quantity": STARTING_WEEKDAY_QUANTITIES[weekday],
                        "confidence": STARTING_PROFILE_CONFIDENCE,
                        "sample_size": 0,
                        "source": STARTING_PROFILE_SOURCE,
                        "is_baseline": True,
                    }
                )
                continue

            first_week = observations[0][0]
            points = [
                ((week - first_week).days // 7, float(quantity))
                for week, quantity in observations
            ]
            target_weekday = datetime.strptime(weekday, "%A").weekday()
            target_date = current_week + timedelta(days=target_weekday)
            if target_date <= now.date():
                target_date += timedelta(days=7)
            next_x = (target_date - first_week).days // 7
            prediction, confidence = _linear_forecast(points, next_x)
            opportunities.append(
                {
                    "weekday": weekday,
                    "predicted_quantity": prediction,
                    "confidence": confidence,
                    "sample_size": len(points),
                    "source": FORECAST_SOURCE,
                    "is_baseline": False,
                }
            )

        opportunities.sort(key=lambda item: (-item["predicted_quantity"], item["weekday"]))
        uses_baseline = any(item["is_baseline"] for item in opportunities)
        return {
            "sample_size": sample_size,
            "source": COMBINED_FORECAST_SOURCE if uses_baseline else FORECAST_SOURCE,
            "uses_baseline": uses_baseline,
            "insufficient_history": False,
            "opportunities": opportunities,
        }

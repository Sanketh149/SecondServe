from datetime import UTC, datetime, time, timedelta

from app.models.common import AllergenStatus, Role
from app.models.donation import Donation, DonationStatus
from app.models.user import CurrentUser
from app.services.forecast_service import ForecastService


class DonationHistory:
    def __init__(self, donations: list[Donation]) -> None:
        self.donations = donations

    def list_donations(self, organization_id: str) -> list[Donation]:
        return [
            donation
            for donation in self.donations
            if donation.donor_organization_id == organization_id
        ]


def donation(created_at: datetime, quantity: int) -> Donation:
    return Donation(
        donation_id=f"donation-{created_at.date()}",
        donor_organization_id="org-donor",
        item_name="Prepared meals",
        category="prepared_meal",
        quantity=quantity,
        unit="meals",
        dietary_tags=[],
        declared_allergens=[],
        allergen_status=AllergenStatus.UNKNOWN,
        prepared_at=created_at,
        storage_condition="refrigerated",
        pickup_available_at=created_at,
        usable_until=created_at + timedelta(hours=8),
        analysis_id=None,
        status=DonationStatus.OPEN,
        plan_id=None,
        created_at=created_at,
        updated_at=created_at,
    )


def monday_history(weeks: int) -> list[Donation]:
    now = datetime.now(UTC)
    current_monday = now.date() - timedelta(days=now.weekday())
    return [
        donation(
            datetime.combine(
                current_monday - timedelta(weeks=week),
                time(12),
                tzinfo=UTC,
            ),
            8 + (4 - week) * 2,
        )
        for week in range(1, weeks + 1)
    ]


def donor_user() -> CurrentUser:
    return CurrentUser(uid="donor-user", role=Role.DONOR, organization_id="org-donor")


def test_forecast_uses_transparent_starting_profile_without_history() -> None:
    result = ForecastService(DonationHistory([])).for_user(donor_user())

    assert result["insufficient_history"] is False
    assert result["uses_baseline"] is True
    assert result["sample_size"] == 0
    assert len(result["opportunities"]) == 7
    assert all(item["is_baseline"] for item in result["opportunities"])
    assert all(item["sample_size"] == 0 for item in result["opportunities"])
    assert all(item["predicted_quantity"] > 0 for item in result["opportunities"])


def test_forecast_uses_starting_profile_until_four_real_weekly_observations() -> None:
    result = ForecastService(DonationHistory(monday_history(3))).for_user(donor_user())

    assert result["insufficient_history"] is False
    assert result["uses_baseline"] is True
    assert result["sample_size"] == 3
    monday = next(item for item in result["opportunities"] if item["weekday"] == "Monday")
    assert monday["is_baseline"] is True


def test_forecast_recalculates_from_four_real_weekly_observations() -> None:
    result = ForecastService(DonationHistory(monday_history(4))).for_user(donor_user())

    assert result["insufficient_history"] is False
    assert result["uses_baseline"] is True
    assert result["sample_size"] == 4
    monday = next(item for item in result["opportunities"] if item["weekday"] == "Monday")
    assert monday["is_baseline"] is False
    assert monday["predicted_quantity"] > 0
    assert monday["sample_size"] == 4
    assert 0.1 <= monday["confidence"] <= 0.85

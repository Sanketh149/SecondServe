from datetime import timedelta

from fastapi.testclient import TestClient

from app.models.allocation import Allocation, AllocationStatus
from app.repositories.memory import get_repository
from app.services.route_service import RouteService
from tests.conftest import demo_headers, demo_rescue_window


def test_split_allocation_conserves_quantity(client: TestClient) -> None:
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian grain bowl",
        "category": "prepared_meal",
        "quantity": 32,
        "unit": "meals",
        "dietaryTags": ["vegetarian"],
        "declaredAllergens": [],
        "allergenStatus": "NOT_APPLICABLE",
        "donorConfirmed": True,
        "preparedAt": now.isoformat().replace("+00:00", "Z"),
        "storageCondition": "refrigerated",
        "pickupAvailableAt": pickup.isoformat().replace("+00:00", "Z"),
        "usableUntil": cutoff.isoformat().replace("+00:00", "Z"),
    }
    created = client.post("/api/v1/donations", headers=demo_headers("demo-donor"), json=payload)
    donation_id = created.json()["donationId"]
    plan = client.post(f"/api/v1/rescue-plans/donations/{donation_id}/rescue-plan", headers=demo_headers("demo-donor"))
    body = plan.json()
    assert body["status"] == "FULL"
    assert sum(allocation["quantity"] for allocation in body["allocations"]) == 32
    assert len(body["allocations"]) <= 2


def test_matching_uses_confirmed_completion_history_as_tie_breaker(
    client: TestClient,
    monkeypatch,
) -> None:
    def estimate(self, _donor_id, _recipient_id, departure_at=None):
        return {
            "arrival_at": departure_at + timedelta(minutes=10),
            "distance_meters": 1000,
            "duration_seconds": 600,
            "provider": "TEST_ROUTE",
        }

    def build_route(self, _donor_id, recipient_ids, _departure_at=None):
        return {
            "ordered_recipient_ids": recipient_ids,
            "distance_meters": 1000,
            "duration_seconds": 600,
            "provider": "TEST_ROUTE",
        }

    monkeypatch.setattr(RouteService, "estimate", estimate)
    monkeypatch.setattr(RouteService, "build_route", build_route)
    repository = get_repository()
    now, _, _ = demo_rescue_window()
    for recipient_id, confirmed in [
        ("rcp-community", 4),
        ("rcp-hope", 2),
    ]:
        for index in range(3):
            repository.create_allocation(
                Allocation(
                    allocation_id=f"history-{recipient_id}-{index}",
                    plan_id=f"history-plan-{recipient_id}-{index}",
                    donation_id=f"history-donation-{recipient_id}-{index}",
                    recipient_id=recipient_id,
                    quantity=4,
                    status=AllocationStatus.DELIVERED,
                    confirmed_quantity=confirmed,
                    active_candidate_index=0,
                    assigned_candidate_ids=[recipient_id],
                    created_at=now,
                    updated_at=now,
                )
            )

    now, pickup, cutoff = demo_rescue_window()
    created = client.post(
        "/api/v1/donations",
        headers=demo_headers("demo-donor"),
        json={
            "itemName": "Vegetarian meals",
            "category": "prepared_meal",
            "quantity": 4,
            "unit": "meals",
            "dietaryTags": ["vegetarian"],
            "declaredAllergens": [],
            "allergenStatus": "NOT_APPLICABLE",
            "donorConfirmed": True,
            "preparedAt": now.isoformat(),
            "storageCondition": "refrigerated",
            "pickupAvailableAt": pickup.isoformat(),
            "usableUntil": cutoff.isoformat(),
        },
    )
    plan = client.post(
        f"/api/v1/donations/{created.json()['donationId']}/rescue-plan",
        headers=demo_headers("demo-donor"),
    )

    assert plan.status_code == 200, plan.text
    first = plan.json()["allocations"][0]
    assert first["recipientId"] == "rcp-community"
    assert first["recipientCompletionRate"] == 1.0
    assert first["completionHistorySampleSize"] == 3


def test_any_food_category_accepts_other_donations(
    client: TestClient,
    monkeypatch,
) -> None:
    def estimate(self, _donor_id, _recipient_id, departure_at=None):
        return {
            "arrival_at": departure_at + timedelta(minutes=10),
            "distance_meters": 1000,
            "duration_seconds": 600,
            "provider": "TEST_ROUTE",
        }

    def build_route(self, _donor_id, recipient_ids, _departure_at=None):
        return {
            "ordered_recipient_ids": recipient_ids,
            "distance_meters": 1000,
            "duration_seconds": 600,
            "provider": "TEST_ROUTE",
        }

    monkeypatch.setattr(RouteService, "estimate", estimate)
    monkeypatch.setattr(RouteService, "build_route", build_route)
    repository = get_repository()
    recipient = repository.get_recipient("rcp-community")
    assert recipient is not None
    repository.update_recipient(
        recipient.recipient_id,
        accepted_categories=["any_food"],
    )
    now, pickup, cutoff = demo_rescue_window()
    created = client.post(
        "/api/v1/donations",
        headers=demo_headers("demo-donor"),
        json={
            "itemName": "Mixed refrigerated food",
            "category": "other",
            "quantity": 4,
            "unit": "meals",
            "dietaryTags": [],
            "declaredAllergens": [],
            "allergenStatus": "NOT_APPLICABLE",
            "donorConfirmed": True,
            "preparedAt": now.isoformat(),
            "storageCondition": "refrigerated",
            "pickupAvailableAt": pickup.isoformat(),
            "usableUntil": cutoff.isoformat(),
        },
    )
    plan = client.post(
        f"/api/v1/donations/{created.json()['donationId']}/rescue-plan",
        headers=demo_headers("demo-donor"),
    )

    assert plan.status_code == 200, plan.text
    assert plan.json()["allocations"][0]["recipientId"] == "rcp-community"

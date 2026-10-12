from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.errors import SecondServeError
from app.config import get_settings
from app.models.donation import DonationStatus
from app.models.offer import Offer, OfferStatus
from app.repositories.memory import InMemoryRepository, get_repository
from app.services.offer_service import OfferService
from app.services.route_service import RouteService
from tests.conftest import demo_headers, demo_rescue_window


def test_local_offer_expiry_is_explicitly_unscheduled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "local")
    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(settings, "cloud_tasks_project_id", None)
    monkeypatch.setattr(settings, "cloud_tasks_location", None)
    monkeypatch.setattr(settings, "cloud_tasks_service_url", None)
    monkeypatch.setattr(settings, "cloud_tasks_service_account", None)
    now = datetime.now(UTC)
    offer = Offer(
        offer_id="offer-local",
        allocation_id="allocation-local",
        donation_id="donation-local",
        recipient_id="recipient-local",
        status=OfferStatus.PENDING,
        expires_at=now,
        decision_reason=None,
        created_at=now,
        updated_at=now,
    )

    assert OfferService(InMemoryRepository())._schedule_expiration(offer) is False


def test_non_local_offer_start_requires_expiry_callback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(settings, "cloud_tasks_project_id", None)
    monkeypatch.setattr(settings, "cloud_tasks_location", None)
    monkeypatch.setattr(settings, "cloud_tasks_service_url", None)
    monkeypatch.setattr(settings, "cloud_tasks_service_account", None)
    now = datetime.now(UTC)
    offer = Offer(
        offer_id="offer-production",
        allocation_id="allocation-production",
        donation_id="donation-production",
        recipient_id="recipient-production",
        status=OfferStatus.PENDING,
        expires_at=now,
        decision_reason=None,
        created_at=now,
        updated_at=now,
    )

    with pytest.raises(SecondServeError) as error:
        OfferService(InMemoryRepository())._schedule_expiration(offer)
    assert error.value.code == "CLOUD_TASKS_NOT_CONFIGURED"


def test_offer_started_and_declined_relay_is_state_safe(client: TestClient) -> None:
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian pasta meal",
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
    plan_id = plan.json()["planId"]
    started = client.post(f"/api/v1/rescue-plans/{plan_id}/start", headers=demo_headers("demo-donor"))
    assert started.status_code == 200, started.text
    offer_id = started.json()["offerId"]
    assert offer_id
    duplicate = client.post(
        f"/api/v1/rescue-plans/{plan_id}/start",
        headers=demo_headers("demo-donor"),
    )
    assert duplicate.status_code == 409

    declined = client.post(
        f"/api/v1/recipients/me/offers/{offer_id}/response",
        headers=demo_headers("demo-hope"),
        json={"decision": "DECLINE", "reason": "No pickup capacity"},
    )
    assert declined.status_code == 200, declined.text

    details = client.get(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
    )
    assert details.status_code == 200
    assert details.json()["currentOffer"]["recipientId"] == "rcp-community"
    assert any(event["eventType"] == "OFFER_RELAYED" for event in details.json()["events"])


def test_editing_active_donation_cancels_old_offer_and_rematches(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
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
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian pasta meal",
        "category": "prepared_meal",
        "quantity": 8,
        "unit": "meals",
        "dietaryTags": ["vegetarian"],
        "declaredAllergens": [],
        "allergenStatus": "NOT_APPLICABLE",
        "donorConfirmed": True,
        "preparedAt": now.isoformat(),
        "storageCondition": "refrigerated",
        "pickupAvailableAt": pickup.isoformat(),
        "usableUntil": cutoff.isoformat(),
    }
    created = client.post(
        "/api/v1/donations",
        headers=demo_headers("demo-donor"),
        json=payload,
    )
    donation_id = created.json()["donationId"]
    plan = client.post(
        f"/api/v1/donations/{donation_id}/rescue-plan",
        headers=demo_headers("demo-donor"),
    )
    started = client.post(
        f"/api/v1/rescue-plans/{plan.json()['planId']}/start",
        headers=demo_headers("demo-donor"),
    )
    old_offer_id = started.json()["offerId"]

    updated_payload = {
        **payload,
        "itemName": "Updated vegetarian pasta",
        "quantity": 12,
        "pickupAvailableAt": (pickup + timedelta(minutes=5)).isoformat(),
    }
    updated = client.put(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
        json=updated_payload,
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["itemName"] == "Updated vegetarian pasta"
    assert updated.json()["quantity"] == 12
    assert updated.json()["status"] == DonationStatus.OFFERING.value
    assert get_repository().get_offer(old_offer_id).status == OfferStatus.CANCELLED


def test_editing_is_locked_after_recipient_accepts(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
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
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian pasta meal",
        "category": "prepared_meal",
        "quantity": 8,
        "unit": "meals",
        "dietaryTags": ["vegetarian"],
        "declaredAllergens": [],
        "allergenStatus": "NOT_APPLICABLE",
        "donorConfirmed": True,
        "preparedAt": now.isoformat(),
        "storageCondition": "refrigerated",
        "pickupAvailableAt": pickup.isoformat(),
        "usableUntil": cutoff.isoformat(),
    }
    created = client.post(
        "/api/v1/donations",
        headers=demo_headers("demo-donor"),
        json=payload,
    )
    donation_id = created.json()["donationId"]
    get_repository().update_donation(
        donation_id,
        status=DonationStatus.ACCEPTED,
    )

    response = client.put(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
        json=payload,
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DONATION_NOT_EDITABLE"

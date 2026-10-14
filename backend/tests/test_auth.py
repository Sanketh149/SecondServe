from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.services.route_service import RouteService
from app.services.assistant_service import AssistantService
from tests.conftest import demo_headers, demo_rescue_window


def test_health_and_demo_profile(client: TestClient) -> None:
    assert client.get("/api/v1/health").json()["status"] == "ok"
    response = client.get("/api/v1/users/me", headers=demo_headers("demo-donor"))
    assert response.status_code == 200
    assert response.json()["role"] == "donor"
    assert client.get("/api/v1/me", headers=demo_headers("demo-donor")).json()["uid"] == "demo-donor"


def test_recipient_profile_is_scoped_to_current_organization(client: TestClient) -> None:
    response = client.get(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
    )
    assert response.status_code == 200
    assert response.json()["organizationName"] == "Hope Shelter"
    assert response.json()["capacity"] == 24


def test_recipient_can_update_capacity_and_readiness_profile(client: TestClient) -> None:
    response = client.put(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
        json={
            "timezone": "America/Los_Angeles",
            "hours": {
                "monday": [["10:00", "18:00"]],
                "tuesday": [["10:00", "18:00"]],
                "wednesday": [["10:00", "18:00"]],
                "thursday": [["10:00", "18:00"]],
                "friday": [["10:00", "18:00"]],
                "saturday": [],
                "sunday": [],
            },
            "capacity": 40,
            "unmetDemand": 30,
            "acceptedCategories": ["prepared_meal", "produce"],
            "dietaryTags": ["vegetarian"],
            "allergenRestrictions": ["peanut", "shellfish"],
        },
    )

    assert response.status_code == 200
    assert response.json()["capacity"] == 40
    assert response.json()["unmetDemand"] == 30
    assert response.json()["acceptedCategories"] == ["prepared_meal", "produce"]
    assert response.json()["hours"]["monday"] == [["10:00", "18:00"]]
    assert response.json()["timezone"] == "America/Los_Angeles"


def test_recipient_profile_update_rejects_unmet_demand_over_capacity(
    client: TestClient,
) -> None:
    response = client.put(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
        json={
            "timezone": "America/New_York",
            "hours": {"monday": [["09:00", "17:00"]]},
            "capacity": 10,
            "unmetDemand": 11,
            "acceptedCategories": ["prepared_meal"],
            "dietaryTags": [],
            "allergenRestrictions": [],
        },
    )

    assert response.status_code == 422


def test_recipient_profile_update_accepts_all_day_hours(client: TestClient) -> None:
    response = client.put(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
        json={
            "timezone": "America/New_York",
            "hours": {
                "monday": [["00:00", "00:00"]],
                "tuesday": [["09:00", "17:00"]],
            },
            "capacity": 24,
            "unmetDemand": 24,
            "acceptedCategories": ["prepared_meal"],
            "dietaryTags": [],
            "allergenRestrictions": [],
        },
    )

    assert response.status_code == 200
    assert response.json()["hours"]["monday"] == [["00:00", "00:00"]]


def test_network_insights_are_aggregated_and_use_real_profiles(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/v1/network/insights",
        headers=demo_headers("demo-donor"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["networkOrganizationCount"] == 4
    assert body["heatmapCells"]
    assert any(
        cell["recipientOrganizations"] >= 2 and cell["unmetNeedMeals"] > 0
        for cell in body["heatmapCells"]
    )
    assert all("organizationId" not in cell for cell in body["heatmapCells"])


def test_rescue_assistant_returns_grounded_workspace_guidance(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        AssistantService,
        "_generate_guidance",
        lambda _self, _project, question, context: (
            f"Guidance for {context['organization']}: {question}"
        ),
    )
    response = client.post(
        "/api/v1/assistant/guidance",
        headers=demo_headers("demo-donor"),
        json={"question": "What should I do next?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "Green Leaf Kitchen" in body["answer"]
    assert "donor rescue history" in body["basedOn"]
    assert "does not certify food safety" in body["limitations"]


def test_rescue_assistant_rejects_donation_outside_donor_workspace(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        AssistantService,
        "_generate_guidance",
        lambda *_args: "should not be called",
    )
    response = client.post(
        "/api/v1/assistant/guidance",
        headers=demo_headers("demo-donor"),
        json={"question": "Help me with this", "donationId": "not-owned"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "DONATION_NOT_FOUND"


def test_recipient_profile_change_rematches_open_donations(
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
    created = client.post(
        "/api/v1/donations",
        headers=demo_headers("demo-donor"),
        json={
            "itemName": "Fresh produce box",
            "category": "packaged_food",
            "quantity": 6,
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
    assert created.status_code == 201, created.text
    donation_id = created.json()["donationId"]

    profile = client.get(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
    ).json()
    profile["acceptedCategories"] = ["prepared_meal", "packaged_food"]
    updated_profile = client.put(
        "/api/v1/recipients/me/profile",
        headers=demo_headers("demo-hope"),
        json={
            "timezone": profile["timezone"],
            "hours": profile["hours"],
            "capacity": profile["capacity"],
            "unmetDemand": profile["unmetDemand"],
            "acceptedCategories": profile["acceptedCategories"],
            "dietaryTags": profile["dietaryTags"],
            "allergenRestrictions": profile["allergenRestrictions"],
        },
    )
    assert updated_profile.status_code == 200, updated_profile.text

    detail = client.get(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "OFFERING"
    assert detail.json()["currentOffer"]["recipientId"] == "rcp-hope"

from fastapi.testclient import TestClient

from tests.conftest import demo_headers


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

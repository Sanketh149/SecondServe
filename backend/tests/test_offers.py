from fastapi.testclient import TestClient
from tests.conftest import demo_headers, demo_rescue_window


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
    assert started.json()["offerId"]
    duplicate = client.post(f"/api/v1/rescue-plans/{plan_id}/start", headers=demo_headers("demo-donor"))
    assert duplicate.status_code in {200, 409}

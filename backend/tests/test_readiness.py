from fastapi.testclient import TestClient
from tests.conftest import demo_headers, demo_rescue_window


def test_readiness_blocks_allergen_restriction(client: TestClient) -> None:
    response = client.post(
        "/api/v1/rescue-plans/donations/does-not-exist/rescue-plan",
        headers=demo_headers("demo-donor"),
    )
    assert response.status_code == 404


def test_donation_creation_and_plan_are_owned_by_donor(client: TestClient) -> None:
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian pasta meal",
        "category": "prepared_meal",
        "quantity": 32,
        "unit": "meals",
        "dietaryTags": ["vegetarian"],
        "declaredAllergens": ["wheat", "dairy"],
        "allergenStatus": "DONOR_CONFIRMED",
        "preparedAt": now.isoformat().replace("+00:00", "Z"),
        "storageCondition": "refrigerated",
        "pickupAvailableAt": pickup.isoformat().replace("+00:00", "Z"),
        "usableUntil": cutoff.isoformat().replace("+00:00", "Z"),
    }
    created = client.post("/api/v1/donations", headers=demo_headers("demo-donor"), json=payload)
    assert created.status_code == 201, created.text
    donation_id = created.json()["donationId"]
    plan = client.post(f"/api/v1/rescue-plans/donations/{donation_id}/rescue-plan", headers=demo_headers("demo-donor"))
    assert plan.status_code == 200, plan.text
    body = plan.json()
    assert body["status"] in {"FULL", "PARTIAL"}
    assert body["allocatedQuantity"] + body["unallocatedQuantity"] == 32
    assert all(allocation["quantity"] > 0 for allocation in body["allocations"])

from fastapi.testclient import TestClient

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

from fastapi.testclient import TestClient

from tests.conftest import demo_headers, demo_rescue_window


def test_donor_to_recipient_confirmed_receipt_flow(client: TestClient) -> None:
    now, pickup, cutoff = demo_rescue_window()
    payload = {
        "itemName": "Vegetarian meal",
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
    assert created.status_code == 201, created.text
    donation_id = created.json()["donationId"]

    preview = client.post(
        "/api/v1/donations/rescue-plan-preview",
        headers=demo_headers("demo-donor"),
        json=payload,
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["status"] == "FULL"

    plan = client.post(
        f"/api/v1/donations/{donation_id}/rescue-plan",
        headers=demo_headers("demo-donor"),
    )
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["planId"]

    started = client.post(
        f"/api/v1/rescue-plans/{plan_id}/start",
        headers=demo_headers("demo-donor"),
    )
    assert started.status_code == 200, started.text
    offer_id = started.json()["offerId"]
    handoff_code = started.json()["handoffCode"]
    assert offer_id and handoff_code

    donor_detail = client.get(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
    )
    assert donor_detail.status_code == 200
    assert donor_detail.json()["handoffCode"] == handoff_code

    wrong_recipient = client.post(
        f"/api/v1/recipients/me/offers/{offer_id}/response",
        headers=demo_headers("demo-community"),
        json={"decision": "ACCEPT"},
    )
    assert wrong_recipient.status_code == 403

    recipient_offers = client.get(
        "/api/v1/recipients/me/offers",
        headers=demo_headers("demo-hope"),
    )
    assert recipient_offers.status_code == 200
    assert any(item["offerId"] == offer_id for item in recipient_offers.json()["offers"])

    accepted = client.post(
        f"/api/v1/recipients/me/offers/{offer_id}/response",
        headers=demo_headers("demo-hope"),
        json={"decision": "ACCEPT"},
    )
    assert accepted.status_code == 200, accepted.text

    allocation_id = plan.json()["allocations"][0]["allocationId"]
    bad_receipt = client.post(
        f"/api/v1/allocations/{allocation_id}/receipt",
        headers=demo_headers("demo-hope"),
        json={"handoffCode": "000000", "quantityReceived": 8},
    )
    assert bad_receipt.status_code == 422

    receipt = client.post(
        f"/api/v1/allocations/{allocation_id}/receipt",
        headers=demo_headers("demo-hope"),
        json={"handoffCode": handoff_code, "quantityReceived": 6},
    )
    assert receipt.status_code == 200, receipt.text
    receipt_body = receipt.json()
    assert receipt_body["quantityReceived"] == 6
    assert "handoffCodeHash" not in receipt_body

    impact = client.get(
        "/api/v1/impact/summary",
        headers=demo_headers("demo-donor"),
    )
    assert impact.status_code == 200
    assert impact.json()["confirmedQuantity"] == 6

    updated = client.get(
        f"/api/v1/donations/{donation_id}",
        headers=demo_headers("demo-donor"),
    )
    assert updated.status_code == 200
    assert updated.json()["confirmedQuantity"] == 6
    assert updated.json()["status"] == "PARTIALLY_RESCUED"

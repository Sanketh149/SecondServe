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

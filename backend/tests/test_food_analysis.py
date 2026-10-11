from fastapi.testclient import TestClient
from tests.conftest import demo_headers


def test_food_analysis_returns_unverified_suggestions(client: TestClient) -> None:
    response = client.post(
        "/api/v1/donations/analyze",
        headers=demo_headers("demo-donor"),
        files={"file": ("meal.jpg", b"image-bytes", "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["candidate"]["name"]["source"] == "AI_SUGGESTED"
    assert body["candidate"]["quantitySuggestion"]["source"] == "UNKNOWN"
    assert body["safetyNotice"].startswith("Visual analysis")


def test_analysis_rejects_non_image(client: TestClient) -> None:
    response = client.post(
        "/api/v1/donations/analyze",
        headers=demo_headers("demo-donor"),
        files={"file": ("meal.txt", b"not-an-image", "text/plain")},
    )
    assert response.status_code == 415

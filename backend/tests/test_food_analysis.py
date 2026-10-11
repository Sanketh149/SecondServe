from fastapi.testclient import TestClient

from app.config import get_settings
from app.services.gemini_service import GeminiService
from tests.conftest import (
    REAL_GEMINI_GENERATE_CANDIDATE,
    demo_headers,
)


def test_food_analysis_returns_unverified_suggestions(client: TestClient) -> None:
    response = client.post(
        "/api/v1/donations/analyze",
        headers=demo_headers("demo-donor"),
        files={"file": ("meal.jpg", b"\xff\xd8\xffimage-bytes", "image/jpeg")},
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


def test_analysis_requires_vertex_ai_configuration(
    client: TestClient,
    monkeypatch,
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "vertex_ai_project_id", None)
    monkeypatch.setattr(settings, "firestore_project_id", None)
    monkeypatch.setattr(
        GeminiService,
        "_generate_candidate",
        REAL_GEMINI_GENERATE_CANDIDATE,
    )
    response = client.post(
        "/api/v1/donations/analyze",
        headers=demo_headers("demo-donor"),
        files={"file": ("meal.jpg", b"\xff\xd8\xffimage-bytes", "image/jpeg")},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AI_NOT_CONFIGURED"
    assert "manual entry" in response.json()["error"]["message"]


def test_analysis_rejects_mismatched_image_signature(client: TestClient) -> None:
    response = client.post(
        "/api/v1/donations/analyze",
        headers=demo_headers("demo-donor"),
        files={"file": ("meal.jpg", b"not actually jpeg", "image/jpeg")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "IMAGE_CONTENT_MISMATCH"

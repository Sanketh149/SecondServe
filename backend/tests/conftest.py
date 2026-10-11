from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from app.api import dependencies
from app.config import get_settings
from app.main import app
from app.repositories.memory import get_repository
from app.services.gemini_service import GeminiService

REAL_GEMINI_GENERATE_CANDIDATE = GeminiService._generate_candidate


def demo_gemini_candidate(self, image, content_type):
    return {
        "name": "Vegetarian meal",
        "category": "prepared_meal",
        "visiblePackaging": "clear_plastic_container",
        "dietaryTags": ["vegetarian"],
        "potentialAllergens": [],
        "quantitySuggestion": None,
        "confidence": {
            "name": 0.8,
            "category": 0.8,
            "visiblePackaging": 0.7,
            "dietaryTags": 0.0,
            "potentialAllergens": 0.0,
            "quantitySuggestion": 0.0,
        },
    }


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(dependencies.settings, "demo_mode", True)
    monkeypatch.setattr(get_settings(), "vertex_ai_project_id", "test-project")
    monkeypatch.setattr(
        GeminiService,
        "_generate_candidate",
        demo_gemini_candidate,
    )
    get_repository().__init__()
    get_repository().initialize_demo_data()
    with TestClient(app) as instance:
        yield instance


def demo_headers(uid: str) -> dict[str, str]:
    return {"X-Demo-User": uid}


def demo_rescue_window() -> tuple[datetime, datetime, datetime]:
    zone = ZoneInfo("America/New_York")
    now = datetime.now(zone)
    pickup_day = now.date()
    if now.weekday() >= 5 or now.time() >= time(16, 30):
        pickup_day += timedelta(days=1)
    while pickup_day.weekday() >= 5:
        pickup_day += timedelta(days=1)
    pickup = datetime.combine(pickup_day, time(10, 0), tzinfo=zone)
    if pickup <= now:
        pickup_day += timedelta(days=1)
        while pickup_day.weekday() >= 5:
            pickup_day += timedelta(days=1)
        pickup = datetime.combine(pickup_day, time(10, 0), tzinfo=zone)
    return now, pickup, pickup + timedelta(hours=5)

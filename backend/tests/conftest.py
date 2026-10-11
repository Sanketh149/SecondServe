import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.memory import get_repository


@pytest.fixture
def client() -> TestClient:
    get_repository().__init__()
    get_repository().initialize_demo_data()
    with TestClient(app) as instance:
        yield instance


def demo_headers(uid: str) -> dict[str, str]:
    return {"X-Demo-User": uid}

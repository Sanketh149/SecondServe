from __future__ import annotations

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SecondServe API"
    environment: str = "local"
    frontend_origin: str = "http://localhost:5173"
    firestore_database: str = "(default)"
    firestore_project_id: str | None = None
    gcs_bucket: str | None = None
    vertex_ai_project_id: str | None = None
    vertex_ai_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"
    google_maps_api_key: str | None = None
    cloud_tasks_queue: str = "secondserve-offers"
    cloud_tasks_project_id: str | None = None
    cloud_tasks_location: str | None = None
    cloud_tasks_service_url: str | None = None
    cloud_tasks_service_account: str | None = None
    offer_ttl_minutes: int = 5
    max_upload_bytes: int = 5 * 1024 * 1024
    firebase_project_id: str | None = None
    demo_mode: bool = True
    seed_data_path: str = "../data/demo"
    request_timeout_seconds: float = 30.0

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


@lru_cache

def get_settings() -> Settings:
    return Settings()

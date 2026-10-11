from datetime import datetime, timedelta, timezone
from typing import Any

from app.models.organization import Organization
from app.models.recipient import Recipient
from app.repositories.memory import InMemoryRepository


class RouteService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def estimate(self, donor_organization_id: str, recipient_id: str) -> dict[str, Any] | None:
        donor = self.repository.get_organization(donor_organization_id)
        recipient = self.repository.get_recipient(recipient_id)
        if donor is None or recipient is None:
            return None
        origin = donor.location
        destination = recipient.location
        origin_time = datetime.now(timezone.utc)
        duration_seconds = int(abs(origin.latitude - destination.latitude) * 120 + abs(origin.longitude - destination.longitude) * 90)
        return {
            "arrival_at": origin_time + timedelta(seconds=duration_seconds),
            "distance_meters": int(duration_seconds * 8),
            "duration_seconds": duration_seconds,
            "provider": "DEMO_ROUTE",
        }

    def build_route(self, recipient_ids: list[str]) -> dict[str, Any] | None:
        if not recipient_ids:
            return None
        first = self.repository.get_recipient(recipient_ids[0])
        if first is None:
            return None
        latest = datetime.now(timezone.utc)
        return {
            "ordered_recipient_ids": recipient_ids,
            "distance_meters": 0,
            "duration_seconds": 0,
            "provider": "DEMO_ROUTE",
        }

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import get_settings
from app.models.organization import Organization
from app.models.recipient import Recipient
from app.repositories.memory import InMemoryRepository

logger = logging.getLogger(__name__)
ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
ROUTE_FIELD_MASK = (
    "routes.duration,routes.distanceMeters,routes.legs.duration,"
    "routes.legs.distanceMeters"
)
DEMO_METRICS = {
    "rcp-hope": (3_200, 12 * 60),
    "rcp-community": (5_100, 19 * 60),
    "rcp-pantry": (6_400, 17 * 60),
}


class RouteService:
    def __init__(
        self,
        repository: InMemoryRepository,
        client: httpx.Client | None = None,
    ) -> None:
        self.repository = repository
        self.settings = get_settings()
        self.client = client or httpx.Client(timeout=self.settings.request_timeout_seconds)

    def estimate(
        self,
        donor_organization_id: str,
        recipient_id: str,
        departure_at: datetime | None = None,
    ) -> dict[str, Any] | None:
        donor = self.repository.get_organization(donor_organization_id)
        recipient = self.repository.get_recipient(recipient_id)
        if donor is None or recipient is None:
            return None
        departure = self._utc(departure_at or datetime.now(timezone.utc))
        if self.settings.google_maps_api_key:
            result = self._compute_route(donor, recipient, departure)
            if result is None:
                return None
            duration = result["duration_seconds"]
            return {
                **result,
                "arrival_at": departure + timedelta(seconds=duration),
                "provider": "GOOGLE_ROUTES",
            }
        if not self.settings.demo_mode:
            return None

        distance, duration = DEMO_METRICS.get(recipient_id, (4_000, 15 * 60))
        return {
            "arrival_at": departure + timedelta(seconds=duration),
            "distance_meters": distance,
            "duration_seconds": duration,
            "provider": "DEMO_ROUTE",
        }

    def build_route(
        self,
        donor_organization_id: str,
        recipient_ids: list[str],
        departure_at: datetime | None = None,
    ) -> dict[str, Any] | None:
        if not recipient_ids:
            return None
        donor = self.repository.get_organization(donor_organization_id)
        stops = [self.repository.get_recipient(recipient_id) for recipient_id in recipient_ids]
        if donor is None or any(stop is None for stop in stops):
            return None
        departure = self._utc(departure_at or datetime.now(timezone.utc))
        if self.settings.google_maps_api_key:
            return self._compute_multi_stop_route(donor, stops, recipient_ids, departure)
        if not self.settings.demo_mode:
            return None
        estimates = [
            DEMO_METRICS.get(stop.recipient_id, (4_000, 15 * 60))
            for stop in stops
        ]
        return {
            "ordered_recipient_ids": recipient_ids,
            "distance_meters": sum(distance for distance, _ in estimates),
            "duration_seconds": sum(duration for _, duration in estimates),
            "provider": "DEMO_ROUTE",
        }

    def _compute_route(
        self,
        donor: Organization,
        recipient: Recipient,
        departure: datetime,
    ) -> dict[str, int] | None:
        route = self._request_route(
            donor,
            recipient,
            [],
            departure,
        )
        if route is None:
            return None
        return {
            "distance_meters": int(route["distanceMeters"]),
            "duration_seconds": self._duration_seconds(route["duration"]),
        }

    def _compute_multi_stop_route(
        self,
        donor: Organization,
        stops: list[Recipient],
        recipient_ids: list[str],
        departure: datetime,
    ) -> dict[str, Any] | None:
        route = self._request_route(donor, stops[-1], stops[:-1], departure)
        if route is None:
            return None
        return {
            "ordered_recipient_ids": recipient_ids,
            "distance_meters": int(route["distanceMeters"]),
            "duration_seconds": self._duration_seconds(route["duration"]),
            "provider": "GOOGLE_ROUTES",
        }

    def _request_route(
        self,
        donor: Organization,
        destination: Recipient,
        intermediates: list[Recipient],
        departure: datetime,
    ) -> dict[str, Any] | None:
        body = {
            "origin": self._waypoint(donor.location.latitude, donor.location.longitude),
            "destination": self._waypoint(
                destination.location.latitude,
                destination.location.longitude,
            ),
            "intermediates": [
                self._waypoint(stop.location.latitude, stop.location.longitude)
                for stop in intermediates
            ],
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
            "departureTime": departure.isoformat().replace("+00:00", "Z"),
        }
        try:
            response = self.client.post(
                ROUTES_URL,
                json=body,
                headers={
                    "X-Goog-Api-Key": self.settings.google_maps_api_key or "",
                    "X-Goog-FieldMask": ROUTE_FIELD_MASK,
                },
            )
            response.raise_for_status()
            routes = response.json().get("routes", [])
            if not routes:
                logger.warning("Google Routes returned no route for a rescue plan")
                return None
            return routes[0]
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            logger.exception("Google Routes request failed")
            return None

    @staticmethod
    def _waypoint(latitude: float, longitude: float) -> dict[str, Any]:
        return {"location": {"latLng": {"latitude": latitude, "longitude": longitude}}}

    @staticmethod
    def _duration_seconds(value: str) -> int:
        if not value.endswith("s"):
            raise ValueError("Google Routes returned an invalid duration")
        return int(float(value[:-1]))

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

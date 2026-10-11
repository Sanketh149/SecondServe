from __future__ import annotations

import logging

from fastapi import APIRouter, Header
from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.api import errors
from app.config import get_settings
from app.repositories.memory import get_repository
from app.services.offer_service import OfferService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal/offers")


class OfferExpiryRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )
    offer_id: str = Field(min_length=1)


def verify_cloud_task(authorization: str | None) -> None:
    settings = get_settings()
    if not settings.cloud_tasks_service_url or not settings.cloud_tasks_service_account:
        raise errors.SecondServeError(
            503,
            "CLOUD_TASKS_NOT_CONFIGURED",
            "Offer expiry is not configured.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise errors.SecondServeError(401, "TASK_UNAUTHORIZED", "A Cloud Tasks OIDC token is required.")
    try:
        claims = id_token.verify_oauth2_token(
            authorization.removeprefix("Bearer "),
            google_auth_requests.Request(),
            audience=settings.cloud_tasks_service_url.rstrip("/"),
        )
    except Exception as exc:
        logger.exception("Cloud Tasks OIDC token verification failed")
        raise errors.SecondServeError(401, "TASK_UNAUTHORIZED", "The Cloud Tasks OIDC token is invalid.") from exc
    if (
        claims.get("email") != settings.cloud_tasks_service_account
        or claims.get("email_verified") is not True
    ):
        raise errors.SecondServeError(403, "TASK_FORBIDDEN", "The caller is not the configured Cloud Tasks service account.")


@router.post("/{offer_id}/expire")
def expire_offer(
    offer_id: str,
    body: OfferExpiryRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    verify_cloud_task(authorization)
    if body.offer_id != offer_id:
        raise errors.SecondServeError(422, "OFFER_ID_MISMATCH", "The task payload does not match the offer path.")
    offer = OfferService(get_repository()).expire(offer_id)
    return {"offerId": offer.offer_id, "status": offer.status.value}

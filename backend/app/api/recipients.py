from fastapi import APIRouter, Depends

from app.api import errors
from app.api.dependencies import require_role
from app.models.recipient import Recipient
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.recipient import (
    RecipientProfileResponse,
    UpdateRecipientProfileRequest,
)
from app.services.dynamic_matching_service import DynamicMatchingService

router = APIRouter(prefix="/recipients")


@router.get("/me/profile", response_model=RecipientProfileResponse)
def get_my_recipient_profile(
    user: CurrentUser = Depends(require_role("recipient")),
) -> Recipient:
    recipient = next(
        (
            item
            for item in get_repository().list_recipients()
            if item.organization_id == user.organization_id
        ),
        None,
    )
    if recipient is None:
        raise errors.SecondServeError(
            404,
            "RECIPIENT_PROFILE_NOT_FOUND",
            "No recipient profile is configured for this organization.",
        )
    return recipient


@router.put("/me/profile", response_model=RecipientProfileResponse)
def update_my_recipient_profile(
    request: UpdateRecipientProfileRequest,
    user: CurrentUser = Depends(require_role("recipient")),
) -> Recipient:
    repository = get_repository()
    recipient = next(
        (
            item
            for item in repository.list_recipients()
            if item.organization_id == user.organization_id
        ),
        None,
    )
    if recipient is None:
        raise errors.SecondServeError(
            404,
            "RECIPIENT_PROFILE_NOT_FOUND",
            "No recipient profile is configured for this organization.",
        )
    matching_fields = (
        "timezone",
        "hours",
        "capacity",
        "unmet_demand",
        "accepted_categories",
        "dietary_tags",
        "allergen_restrictions",
    )
    readiness_changed = any(
        getattr(recipient, field) != getattr(request, field)
        for field in matching_fields
    )
    updated = repository.update_recipient(
        recipient.recipient_id,
        timezone=request.timezone,
        hours={
            day: [[opening, closing] for opening, closing in ranges]
            for day, ranges in request.hours.items()
        },
        capacity=request.capacity,
        unmet_demand=request.unmet_demand,
        accepted_categories=request.accepted_categories,
        dietary_tags=request.dietary_tags,
        allergen_restrictions=request.allergen_restrictions,
    )
    if updated is None:
        raise errors.SecondServeError(
            404,
            "RECIPIENT_PROFILE_NOT_FOUND",
            "No recipient profile is configured for this organization.",
        )
    if readiness_changed:
        DynamicMatchingService(repository).refresh_for_recipient(
            updated.recipient_id
        )
    return updated

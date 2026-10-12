from datetime import time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends

from app.api import errors
from app.api.dependencies import get_current_user
from app.models.common import Role, utc_now
from app.models.organization import Organization
from app.models.recipient import Recipient
from app.models.user import CurrentUser, UserProfile
from app.repositories.memory import get_repository
from app.schemas.auth import CreateProfileRequest, MeResponse
from app.utils.ids import new_id

router = APIRouter()


@router.get("/users/me", response_model=MeResponse, include_in_schema=False)
@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    repository = get_repository()
    profile = repository.get_user(user.uid)
    if profile is None:
        return MeResponse(
            uid=user.uid,
            display_name=user.display_name,
        )
    organization = repository.get_organization(profile.organization_id)
    recipient = next(
        (
            item
            for item in repository.list_recipients()
            if item.organization_id == profile.organization_id
        ),
        None,
    )
    return MeResponse(
        uid=profile.uid,
        role=profile.role.value,
        organization_id=profile.organization_id,
        display_name=profile.display_name,
        organization_name=organization.name if organization else None,
        organization_address=organization.address if organization else None,
        recipient_id=recipient.recipient_id if recipient else None,
    )


@router.post("/me/profile", response_model=MeResponse, status_code=201)
def create_profile(
    request: CreateProfileRequest,
    user: CurrentUser = Depends(get_current_user),
) -> MeResponse:
    repository = get_repository()
    if repository.get_user(user.uid):
        raise errors.SecondServeError(
            409,
            "PROFILE_ALREADY_EXISTS",
            "An organization profile is already linked to this account.",
        )
    try:
        ZoneInfo(request.timezone)
        opening = time.fromisoformat(request.open_time)
        closing = time.fromisoformat(request.close_time)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise errors.SecondServeError(
            422,
            "INVALID_ORGANIZATION_HOURS",
            "Enter a valid time zone and opening/closing time.",
        ) from exc
    if opening >= closing:
        raise errors.SecondServeError(
            422,
            "INVALID_ORGANIZATION_HOURS",
            "Closing time must be later than opening time.",
        )

    now = utc_now()
    organization_id = new_id("org")
    role = Role(request.role)
    organization = Organization(
        organization_id=organization_id,
        name=request.organization_name.strip(),
        type=role.value,
        location=request.location,
        address=request.address.strip(),
        created_at=now,
        updated_at=now,
    )
    profile = UserProfile(
        uid=user.uid,
        display_name=(request.display_name or user.display_name or request.organization_name).strip(),
        role=role,
        organization_id=organization_id,
        created_at=now,
        updated_at=now,
    )

    recipient = None
    if role == Role.RECIPIENT:
        open_days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
        if request.open_saturday:
            open_days.append("saturday")
        if request.open_sunday:
            open_days.append("sunday")
        opening_hours = [
            (request.open_time, request.close_time),
        ]
        recipient = Recipient(
                recipient_id=new_id("rcp"),
                organization_id=organization_id,
                organization_name=organization.name,
                active=True,
                location=request.location,
                timezone=request.timezone,
                hours={
                    day: opening_hours if day in open_days else []
                    for day in (
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    )
                },
                capacity=request.capacity or 0,
                unmet_demand=request.unmet_demand or 0,
                accepted_categories=request.accepted_categories,
                dietary_tags=request.dietary_tags,
                allergen_restrictions=request.allergen_restrictions,
                confirmed_deliveries=[],
                created_at=now,
                updated_at=now,
            )
    try:
        repository.create_organization_profile(organization, profile, recipient)
    except ValueError as exc:
        raise errors.SecondServeError(
            409,
            "PROFILE_ALREADY_EXISTS",
            "An organization profile is already linked to this account.",
        ) from exc
    return MeResponse(
        uid=profile.uid,
        role=profile.role.value,
        organization_id=organization_id,
        display_name=profile.display_name,
        organization_name=organization.name,
        organization_address=organization.address,
        recipient_id=recipient.recipient_id if recipient else None,
    )

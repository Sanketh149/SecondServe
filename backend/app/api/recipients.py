from fastapi import APIRouter, Depends

from app.api import errors
from app.api.dependencies import require_role
from app.models.recipient import Recipient
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.recipient import RecipientProfileResponse

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

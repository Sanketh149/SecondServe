from fastapi import APIRouter, Depends
from app.api.dependencies import get_current_user
from app.models.user import CurrentUser
from app.schemas.auth import MeResponse

router = APIRouter(prefix="/users")

@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser = Depends(get_current_user)) -> MeResponse:
    from app.repositories.memory import get_repository

    profile = get_repository().get_user(user.uid)
    return MeResponse(
        uid=user.uid,
        role=user.role.value,
        organization_id=user.organization_id,
        display_name=profile.display_name if profile else user.uid,
    )

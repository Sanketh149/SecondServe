from fastapi import APIRouter, Depends

from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.assistant import GuidanceRequest, GuidanceResponse
from app.services.assistant_service import AssistantService

router = APIRouter(prefix="/assistant")


@router.post("/guidance", response_model=GuidanceResponse)
def rescue_guidance(
    request: GuidanceRequest,
    user: CurrentUser = Depends(require_role("donor", "recipient")),
) -> GuidanceResponse:
    return GuidanceResponse(
        **AssistantService(get_repository()).guide(
            user,
            request.question,
            request.donation_id,
        )
    )

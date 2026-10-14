from fastapi import APIRouter, Depends

from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.network import NetworkInsightsResponse
from app.services.network_insights_service import NetworkInsightsService

router = APIRouter(prefix="/network")


@router.get("/insights", response_model=NetworkInsightsResponse)
def network_insights(
    user: CurrentUser = Depends(require_role("donor", "recipient")),
) -> NetworkInsightsResponse:
    return NetworkInsightsResponse(
        **NetworkInsightsService(get_repository()).for_user(user)
    )

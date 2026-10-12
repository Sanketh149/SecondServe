from fastapi import APIRouter, Depends

from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.schemas.impact import ForecastResponse
from app.services.forecast_service import ForecastService
from app.repositories.memory import get_repository

router = APIRouter(prefix="/forecast")

@router.get("/opportunities", response_model=ForecastResponse)
def opportunities(
    user: CurrentUser = Depends(require_role("donor", "recipient")),
) -> ForecastResponse:
    return ForecastResponse(**ForecastService(get_repository()).for_user(user))

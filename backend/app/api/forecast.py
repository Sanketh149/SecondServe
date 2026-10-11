from fastapi import APIRouter, Depends
from app.api.dependencies import get_current_user
from app.models.user import CurrentUser
from app.schemas.impact import ForecastResponse

router = APIRouter(prefix="/forecast")

@router.get("/opportunities", response_model=ForecastResponse)
def opportunities(user: CurrentUser = Depends(get_current_user)) -> ForecastResponse:
    return ForecastResponse(
        sample_size=0,
        source="seeded-demo",
        insufficient_history=True,
        opportunities=[],
    )

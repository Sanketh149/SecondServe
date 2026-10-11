from fastapi import APIRouter, Depends
from app.api.dependencies import get_current_user
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.impact import ImpactSummary

router = APIRouter(prefix="/impact")

@router.get("/summary", response_model=ImpactSummary)
def impact_summary(user: CurrentUser = Depends(get_current_user)) -> ImpactSummary:
    data = get_repository().get_impact(user.organization_id)
    return ImpactSummary(
        confirmed_quantity=data["confirmed_quantity"],
        rescued_meals=data["confirmed_quantity"],
        receipts_count=data["receipts_count"],
        period=data["period"],
    )

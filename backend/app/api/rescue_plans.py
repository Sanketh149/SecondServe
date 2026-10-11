from fastapi import APIRouter, Depends
from app.api.dependencies import require_role
from app.api import errors
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.rescue_plan import RescuePlanResponse, RescuePlanStartResponse
from app.services.offer_service import OfferService
from app.services.plan_service import PlanService

router = APIRouter(prefix="/rescue-plans")

@router.post("/{plan_id}/start", response_model=RescuePlanStartResponse)
def start_plan(plan_id: str, user: CurrentUser = Depends(require_role("donor"))) -> RescuePlanStartResponse:
    offer_service = OfferService(get_repository())
    offer, handoff_code = offer_service.start_first_offer(plan_id, user.organization_id)
    return RescuePlanStartResponse(
        plan_id=plan_id,
        offer_id=offer.offer_id if offer else None,
        status="OFFERING" if offer else "NO_OFFER",
        handoff_code=handoff_code,
    )

@router.post("/donations/{donation_id}/rescue-plan", response_model=RescuePlanResponse)
def create_plan(donation_id: str, user: CurrentUser = Depends(require_role("donor"))) -> RescuePlanResponse:
    repository = get_repository()
    donation = repository.get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    return PlanService(repository).create(donation, user.organization_id)

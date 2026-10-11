from fastapi import APIRouter, Depends
from app.api.dependencies import require_role
from app.api import errors
from app.models.allocation import Allocation, AllocationStatus
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.rescue_plan import RescuePlanResponse, RescuePlanStartResponse
from app.services.matching_service import MatchingService
from app.services.route_service import RouteService
from app.services.offer_service import OfferService

router = APIRouter(prefix="/rescue-plans")

@router.post("/{plan_id}/start", response_model=RescuePlanStartResponse)
def start_plan(plan_id: str, user: CurrentUser = Depends(require_role("donor"))) -> RescuePlanStartResponse:
    offer_service = OfferService(get_repository())
    offer = offer_service.start_first_offer(plan_id, user.organization_id)
    return RescuePlanStartResponse(plan_id=plan_id, offer_id=offer.offer_id if offer else None, status="OFFERING")

@router.post("/donations/{donation_id}/rescue-plan", response_model=RescuePlanResponse)
def create_plan(donation_id: str, user: CurrentUser = Depends(require_role("donor"))) -> RescuePlanResponse:
    repository = get_repository()
    donation = repository.get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    service = MatchingService(repository, RouteService(repository))
    plan = service.build_plan(donation, user.organization_id)
    repository.create_plan(plan)
    for allocation_plan in plan.allocations:
        allocation = Allocation(
            allocation_id=allocation_plan.allocation_id,
            plan_id=plan.plan_id,
            donation_id=donation.donation_id,
            recipient_id=allocation_plan.recipient_id,
            quantity=allocation_plan.quantity,
            status=AllocationStatus.PLANNED,
            confirmed_quantity=0,
            active_candidate_index=0,
            assigned_candidate_ids=[],
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )
        repository.create_allocation(allocation)
    return plan

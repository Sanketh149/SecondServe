from fastapi import APIRouter, Depends
from app.api.dependencies import require_role
from app.api import errors
from app.models.donation import CreateDonationRequest, Donation, DonationStatus
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.donation import (
    DonationAllocationResponse,
    DonationDetailResponse,
    DonationListResponse,
    DonationResponse,
)
from app.schemas.rescue_plan import RescuePlanPreviewRequest, RescuePlanResponse
from app.services.plan_service import PlanService
from app.utils.ids import new_id
from app.utils.time import as_utc
from app.models.common import utc_now
from app.services.route_service import RouteService

router = APIRouter(prefix="/donations")


def _validate_analysis(request: CreateDonationRequest, user: CurrentUser) -> None:
    if not request.analysis_id:
        return
    analysis = get_repository().get_analysis(request.analysis_id)
    if analysis is None or analysis.owner_uid != user.uid:
        raise errors.SecondServeError(422, "ANALYSIS_NOT_FOUND", "The image analysis is not available to this donor.")
    if analysis.expires_at <= utc_now():
        raise errors.SecondServeError(422, "ANALYSIS_EXPIRED", "The image analysis has expired; analyze the image again.")
    get_repository().update_analysis(request.analysis_id, confirmed=True)


@router.post("", response_model=DonationResponse, status_code=201)
def create_donation(request: CreateDonationRequest, user: CurrentUser = Depends(require_role("donor"))) -> Donation:
    repository = get_repository()
    _validate_analysis(request, user)
    now = utc_now()
    donation = Donation(
        donation_id=new_id("dn"), donor_organization_id=user.organization_id,
        item_name=request.item_name, category=request.category, quantity=request.quantity,
        unit=request.unit, dietary_tags=request.dietary_tags,
        declared_allergens=request.declared_allergens, allergen_status=request.allergen_status,
        prepared_at=as_utc(request.prepared_at), storage_condition=request.storage_condition,
        pickup_available_at=as_utc(request.pickup_available_at), usable_until=as_utc(request.usable_until),
        analysis_id=request.analysis_id, status=DonationStatus.OPEN, plan_id=None,
        confirmed_quantity=0, handoff_code_hash=None, created_at=now, updated_at=now,
    )
    return repository.create_donation(donation)


@router.get("", response_model=DonationListResponse)
def list_donations(user: CurrentUser = Depends(require_role("donor"))) -> DonationListResponse:
    return DonationListResponse(donations=get_repository().list_donations(user.organization_id))


@router.post("/rescue-plan-preview", response_model=RescuePlanResponse)
def preview_rescue_plan(
    request: RescuePlanPreviewRequest,
    user: CurrentUser = Depends(require_role("donor")),
) -> RescuePlanResponse:
    _validate_analysis(request, user)
    plan = PlanService(get_repository()).preview(request, user.organization_id)
    return plan


@router.post("/{donation_id}/rescue-plan", response_model=RescuePlanResponse)
def create_rescue_plan(
    donation_id: str,
    user: CurrentUser = Depends(require_role("donor")),
) -> RescuePlanResponse:
    repository = get_repository()
    donation = repository.get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    return PlanService(repository).create(donation, user.organization_id)


@router.get("/{donation_id}", response_model=DonationDetailResponse)
def get_donation(
    donation_id: str,
    user: CurrentUser = Depends(require_role("donor", "recipient")),
) -> DonationDetailResponse:
    repository = get_repository()
    donation = get_repository().get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if user.role.value == "donor" and donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    allocations = repository.list_allocations_for_donation(donation_id)
    recipient_by_id = {
        recipient.recipient_id: recipient
        for recipient in repository.list_recipients()
    }
    if user.role.value == "recipient":
        assigned_to_user = any(
            recipient_by_id.get(allocation.recipient_id)
            and recipient_by_id[allocation.recipient_id].organization_id == user.organization_id
            for allocation in allocations
        )
        if not assigned_to_user:
            raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not assigned to this recipient.")

    route_service = RouteService(repository)
    allocation_details = []
    for allocation in allocations:
        recipient = recipient_by_id.get(allocation.recipient_id)
        estimate = route_service.estimate(
            donation.donor_organization_id,
            allocation.recipient_id,
            donation.pickup_available_at,
        )
        duration = estimate["duration_seconds"] if estimate else None
        distance = estimate["distance_meters"] if estimate else None
        allocation_details.append(
            DonationAllocationResponse(
                **allocation.model_dump(),
                recipient_name=recipient.organization_name if recipient else "Recipient",
                distance=f"{distance / 1000:.1f} km" if distance is not None else "Unknown distance",
                eta=f"{max(1, round(duration / 60))} min" if duration is not None else "Unknown arrival",
                received_quantity=allocation.confirmed_quantity,
            )
        )

    offers = repository.list_offers_for_donation(donation_id)
    current_offer = next(
        (
            offer
            for offer in reversed(offers)
            if offer.status.value in {"PENDING", "ACCEPTED"}
        ),
        None,
    )
    plan = repository.get_plan(donation.plan_id) if donation.plan_id else None
    handoff_code = None
    if user.role.value == "donor":
        handoff_code = next(
            (
                repository.get_handoff_code(allocation.allocation_id)
                for allocation in allocations
                if allocation.status.value in {"OFFERING", "ACCEPTED"}
                and repository.get_handoff_code(allocation.allocation_id)
            ),
            None,
        )
    return DonationDetailResponse(
        **donation.model_dump(),
        plan=plan,
        allocations=allocation_details,
        events=sorted(repository.list_events(donation_id), key=lambda event: event.occurred_at),
        current_offer=current_offer,
        handoff_code=handoff_code,
    )

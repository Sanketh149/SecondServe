from fastapi import APIRouter, Depends

from app.api import errors
from app.api.dependencies import require_role
from app.models.allocation import AllocationStatus
from app.models.common import AllergenStatus, FieldValue, Source, utc_now
from app.models.donation import CreateDonationRequest, Donation, DonationStatus
from app.models.events import Event
from app.models.offer import OfferStatus
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.donation import (
    DonationAllocationResponse,
    DonationDetailResponse,
    DonationListResponse,
    DonationResponse,
    DonationUpdateRequest,
)
from app.schemas.rescue_plan import RescuePlanPreviewRequest, RescuePlanResponse
from app.services.offer_service import OfferService
from app.services.plan_service import PlanService
from app.services.route_service import RouteService
from app.utils.ids import new_id
from app.utils.time import as_utc

router = APIRouter(prefix="/donations")


def _validate_analysis(
    request: CreateDonationRequest,
    user: CurrentUser,
    *,
    confirm: bool = False,
) -> None:
    if not request.analysis_id:
        return
    analysis = get_repository().get_analysis(request.analysis_id)
    if analysis is None or analysis.owner_uid != user.uid:
        raise errors.SecondServeError(422, "ANALYSIS_NOT_FOUND", "The image analysis is not available to this donor.")
    if analysis.expires_at <= utc_now():
        raise errors.SecondServeError(422, "ANALYSIS_EXPIRED", "The image analysis has expired; analyze the image again.")
    if confirm:
        donor_source = Source.DONOR_CONFIRMED
        candidate = dict(analysis.candidate)
        candidate.update(
            {
                "name": FieldValue(
                    value=request.item_name,
                    source=donor_source,
                    confidence=1.0,
                ),
                "category": FieldValue(
                    value=request.category,
                    source=donor_source,
                    confidence=1.0,
                ),
                "dietaryTags": FieldValue(
                    value=request.dietary_tags,
                    source=donor_source,
                    confidence=1.0,
                ),
                "quantitySuggestion": FieldValue(
                    value=request.quantity,
                    source=donor_source,
                    confidence=1.0,
                ),
                "unit": FieldValue(
                    value=request.unit,
                    source=donor_source,
                    confidence=1.0,
                ),
                "allergenStatus": FieldValue(
                    value=request.allergen_status.value,
                    source=(
                        Source.UNKNOWN
                        if request.allergen_status == AllergenStatus.UNKNOWN
                        else donor_source
                    ),
                    confidence=(
                        0.0
                        if request.allergen_status == AllergenStatus.UNKNOWN
                        else 1.0
                    ),
                ),
                "preparedAt": FieldValue(
                    value=as_utc(request.prepared_at).isoformat(),
                    source=donor_source,
                    confidence=1.0,
                ),
                "storageCondition": FieldValue(
                    value=request.storage_condition,
                    source=donor_source,
                    confidence=1.0,
                ),
                "pickupAvailableAt": FieldValue(
                    value=as_utc(request.pickup_available_at).isoformat(),
                    source=donor_source,
                    confidence=1.0,
                ),
                "usableUntil": FieldValue(
                    value=as_utc(request.usable_until).isoformat(),
                    source=donor_source,
                    confidence=1.0,
                ),
            }
        )
        if request.allergen_status != AllergenStatus.UNKNOWN:
            candidate["potentialAllergens"] = FieldValue(
                value=request.declared_allergens,
                source=donor_source,
                confidence=1.0,
            )
        get_repository().update_analysis(
            request.analysis_id,
            confirmed=True,
            candidate=candidate,
        )


@router.post("", response_model=DonationResponse, status_code=201)
def create_donation(request: CreateDonationRequest, user: CurrentUser = Depends(require_role("donor"))) -> Donation:
    repository = get_repository()
    if not request.donor_confirmed:
        raise errors.SecondServeError(
            422,
            "DONOR_CONFIRMATION_REQUIRED",
            "Confirm the food details and donor-entered safety fields before creating a donation.",
        )
    _validate_analysis(request, user, confirm=True)
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


@router.put("/{donation_id}", response_model=DonationResponse)
def update_donation(
    donation_id: str,
    request: DonationUpdateRequest,
    user: CurrentUser = Depends(require_role("donor")),
) -> Donation:
    repository = get_repository()
    donation = repository.get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    if not request.donor_confirmed:
        raise errors.SecondServeError(
            422,
            "DONOR_CONFIRMATION_REQUIRED",
            "Confirm the updated food details and donor-entered safety fields before saving.",
        )

    locked_statuses = {
        DonationStatus.PARTIALLY_ACCEPTED,
        DonationStatus.ACCEPTED,
        DonationStatus.IN_PROGRESS,
        DonationStatus.RESCUED,
        DonationStatus.PARTIALLY_RESCUED,
        DonationStatus.CANCELLED,
    }
    if donation.status in locked_statuses:
        raise errors.SecondServeError(
            409,
            "DONATION_NOT_EDITABLE",
            "A donation cannot be edited after a recipient accepts or a handoff is confirmed.",
        )

    offers = repository.list_offers_for_donation(donation_id)
    allocations = repository.list_allocations_for_donation(donation_id)
    if any(offer.status == OfferStatus.ACCEPTED for offer in offers) or any(
        allocation.status in {AllocationStatus.ACCEPTED, AllocationStatus.DELIVERED}
        or allocation.confirmed_quantity > 0
        for allocation in allocations
    ):
        raise errors.SecondServeError(
            409,
            "DONATION_NOT_EDITABLE",
            "A donation cannot be edited after a recipient accepts or a handoff is confirmed.",
        )
    if as_utc(request.usable_until) <= utc_now():
        raise errors.SecondServeError(
            422,
            "DONATION_CUTOFF_PASSED",
            "Set a usable-until time in the future to save and rematch this donation.",
        )

    cancelled_offer_ids: list[str] = []
    for offer in offers:
        if offer.status == OfferStatus.PENDING:
            updated_offer = repository.update_offer(
                offer.offer_id,
                status=OfferStatus.CANCELLED,
                decision_reason="Donation details changed by donor",
                transition_count=offer.transition_count + 1,
            )
            if updated_offer is None:
                raise errors.SecondServeError(
                    409,
                    "OFFER_UPDATE_FAILED",
                    "An active offer could not be cancelled; the donation was not updated.",
                )
            cancelled_offer_ids.append(offer.offer_id)

    for allocation in allocations:
        if allocation.status in {AllocationStatus.PLANNED, AllocationStatus.OFFERING}:
            updated_allocation = repository.update_allocation(
                allocation.allocation_id,
                status=AllocationStatus.CANCELLED,
                handoff_code_hash=None,
            )
            if updated_allocation is None:
                raise errors.SecondServeError(
                    409,
                    "ALLOCATION_UPDATE_FAILED",
                    "An existing recipient allocation could not be cancelled.",
                )
            repository.delete_handoff_code(allocation.allocation_id)

    changes = request.model_dump(exclude={"analysis_id", "donor_confirmed"})
    updated = repository.update_donation(
        donation_id,
        **changes,
        status=DonationStatus.OPEN,
        plan_id=None,
        handoff_code_hash=None,
    )
    if updated is None:
        raise errors.SecondServeError(
            409,
            "DONATION_UPDATE_FAILED",
            "The donation could not be updated.",
        )

    repository.add_event(
        donation_id,
        Event(
            event_id=new_id("evt"),
            actor_id=user.uid,
            event_type="DONATION_UPDATED",
            occurred_at=utc_now(),
            payload={
                "updatedFields": sorted(changes),
                "cancelledOfferIds": cancelled_offer_ids,
            },
        ),
    )

    plan = PlanService(repository).create(updated, user.organization_id)
    if plan.status.value in {"FULL", "PARTIAL"}:
        OfferService(repository).start_first_offer(plan.plan_id, user.organization_id)
    return repository.get_donation(donation_id) or updated


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
    if donation.plan_id:
        existing_plan = repository.get_plan(donation.plan_id)
        if existing_plan is not None:
            return existing_plan
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
    if donation.plan_id:
        allocations = [
            allocation
            for allocation in allocations
            if allocation.plan_id == donation.plan_id
        ]
    else:
        allocations = [
            allocation
            for allocation in allocations
            if allocation.status != AllocationStatus.CANCELLED
        ]
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
    donor_organization = repository.get_organization(donation.donor_organization_id)
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
        donor_organization_name=(
            donor_organization.name if donor_organization else "Food donor"
        ),
    )

from fastapi import APIRouter, Depends
from app.api.dependencies import get_current_user, require_role
from app.api import errors
from app.models.donation import CreateDonationRequest, Donation, DonationStatus
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.donation import DonationListResponse, DonationResponse
from app.utils.ids import new_id
from app.utils.time import as_utc
from datetime import datetime

router = APIRouter(prefix="/donations")

@router.post("", response_model=DonationResponse, status_code=201)
def create_donation(request: CreateDonationRequest, user: CurrentUser = Depends(require_role("donor"))) -> Donation:
    repository = get_repository()
    donation = Donation(
        donation_id=new_id("dn"), donor_organization_id=user.organization_id,
        item_name=request.item_name, category=request.category, quantity=request.quantity,
        unit=request.unit, dietary_tags=request.dietary_tags,
        declared_allergens=request.declared_allergens, allergen_status=request.allergen_status,
        prepared_at=as_utc(request.prepared_at), storage_condition=request.storage_condition,
        pickup_available_at=as_utc(request.pickup_available_at), usable_until=as_utc(request.usable_until),
        analysis_id=request.analysis_id, status=DonationStatus.OPEN, plan_id=None,
        confirmed_quantity=0, created_at=as_utc(datetime.now()), updated_at=as_utc(datetime.now()),
    )
    return repository.create_donation(donation)

@router.get("", response_model=DonationListResponse)
def list_donations(user: CurrentUser = Depends(require_role("donor"))) -> DonationListResponse:
    return DonationListResponse(donations=get_repository().list_donations(user.organization_id))

@router.get("/{donation_id}", response_model=DonationResponse)
def get_donation(donation_id: str, user: CurrentUser = Depends(require_role("donor", "recipient"))) -> Donation:
    donation = get_repository().get_donation(donation_id)
    if donation is None:
        raise errors.SecondServeError(404, "DONATION_NOT_FOUND", "The donation was not found.")
    if user.role.value == "donor" and donation.donor_organization_id != user.organization_id:
        raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
    return donation

@router.post("/{donation_id}/analyze", response_model=dict)
def analyze_donation(donation_id: str, user: CurrentUser = Depends(require_role("donor"))) -> dict:
    return {"analysisId": new_id("an"), "status": "DEMO_ANALYSIS", "donationId": donation_id}

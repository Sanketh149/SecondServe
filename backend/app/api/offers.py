from fastapi import APIRouter, Depends
from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.services.offer_service import OfferService
from app.models.offer import OfferStatus
from app.schemas.offer import (
    OfferDecisionRequest,
    OfferListResponse,
    OfferResponse as OfferSchema,
)

router = APIRouter(prefix="/recipients/me/offers")

@router.get("", response_model=OfferListResponse)
def list_offers(user: CurrentUser = Depends(require_role("recipient"))) -> OfferListResponse:
    repository = get_repository()
    recipient_ids = [
        recipient.recipient_id
        for recipient in repository.list_recipients()
        if recipient.organization_id == user.organization_id
    ]
    offers = [
        offer
        for recipient_id in recipient_ids
        for offer in repository.list_offers_for_recipient(recipient_id)
        if offer.status in {OfferStatus.PENDING, OfferStatus.ACCEPTED}
    ]
    return OfferListResponse(offers=offers)

@router.post("/{offer_id}/response", response_model=OfferSchema)
def respond_to_offer(
    offer_id: str,
    body: OfferDecisionRequest,
    user: CurrentUser = Depends(require_role("recipient")),
) -> OfferSchema:
    return OfferService(get_repository()).respond(
        offer_id,
        user.organization_id,
        body.decision,
        body.reason,
    )

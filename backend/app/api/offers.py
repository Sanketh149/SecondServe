from fastapi import APIRouter, Depends
from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.models.offer import OfferResponse
from app.repositories.memory import get_repository
from app.services.offer_service import OfferService
from app.schemas.offer import OfferListResponse

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
    ]
    return OfferListResponse(offers=offers)

@router.post("/{offer_id}/response", response_model=OfferResponse)
def respond_to_offer(offer_id: str, body: dict, user: CurrentUser = Depends(require_role("recipient"))) -> OfferResponse:
    return OfferService(get_repository()).respond(offer_id, user.organization_id, body.get("decision", ""), body.get("reason"))

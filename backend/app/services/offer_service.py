from datetime import datetime

from app.api import errors
from app.config import get_settings
from app.models.allocation import Allocation, AllocationStatus
from app.models.donation import Donation, DonationStatus
from app.models.offer import Offer, OfferStatus
from app.models.rescue_plan import RescuePlan
from app.repositories.memory import InMemoryRepository
from app.utils.ids import new_id
from app.utils.time import as_utc


class OfferService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository
        self.ttl_minutes = get_settings().offer_ttl_minutes

    def start_first_offer(self, plan_id: str, donor_organization_id: str) -> Offer | None:
        plan = self.repository.get_plan(plan_id)
        if plan is None:
            raise errors.SecondServeError(404, "PLAN_NOT_FOUND", "The rescue plan was not found.")
        if plan.status not in {"FULL", "PARTIAL"}:
            raise errors.SecondServeError(409, "PLAN_NOT_STARTABLE", "The rescue plan cannot start an offer.")
        donation = self.repository.get_donation(plan.donation_id)
        if donation is None or donation.donor_organization_id != donor_organization_id:
            raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
        if donation.usable_until <= as_utc(datetime.now()):
            raise errors.SecondServeError(409, "DONATION_EXPIRED", "The donation cutoff has passed.")
        allocation = self.repository.get_allocation(plan.allocations[0].allocation_id)
        if allocation is None:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_FOUND", "The planned allocation is missing.")
        if allocation.status != AllocationStatus.PLANNED:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_AVAILABLE", "The planned allocation is not available.")
        allocation = self.repository.update_allocation(allocation.allocation_id, status=AllocationStatus.OFFERING, active_candidate_index=0)
        if allocation is None:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_FOUND", "The planned allocation is missing.")
        now = as_utc(datetime.now())
        offer = Offer(offer_id=new_id("of"), allocation_id=allocation.allocation_id, donation_id=donation.donation_id,
            recipient_id=allocation.recipient_id, status=OfferStatus.PENDING, expires_at=now.replace(microsecond=0),
            decision_reason=None, transition_count=1, created_at=now, updated_at=now)
        return self.repository.create_offer(offer)

    def respond(self, offer_id: str, recipient_organization_id: str, decision: str, reason: str | None) -> Offer:
        offer = self.repository.get_offer(offer_id)
        if offer is None:
            raise errors.SecondServeError(404, "OFFER_NOT_FOUND", "The offer was not found.")
        if offer.status != OfferStatus.PENDING:
            raise errors.SecondServeError(409, "OFFER_NOT_PENDING", "The offer has already transitioned.")
        if decision not in {"ACCEPT", "DECLINE"}:
            raise errors.SecondServeError(422, "INVALID_DECISION", "The decision must be ACCEPT or DECLINE.")
        allocation = self.repository.get_allocation(offer.allocation_id)
        if allocation is None:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_FOUND", "The allocation associated with this offer is missing.")
        if decision == "ACCEPT":
            status = OfferStatus.ACCEPTED
            allocation_status = AllocationStatus.ACCEPTED
        else:
            status = OfferStatus.DECLINED
            allocation_status = AllocationStatus.UNASSIGNED
        updated_offer = self.repository.update_offer(offer.offer_id, status=status, decision_reason=reason, transition_count=offer.transition_count + 1)
        self.repository.update_allocation(allocation.allocation_id, status=allocation_status)
        return updated_offer

    def expire(self, offer_id: str) -> Offer:
        offer = self.repository.get_offer(offer_id)
        if offer is None:
            raise errors.SecondServeError(404, "OFFER_NOT_FOUND", "The offer was not found.")
        if offer.status != OfferStatus.PENDING:
            return offer
        return self.repository.update_offer(offer.offer_id, status=OfferStatus.EXPIRED, transition_count=offer.transition_count + 1)

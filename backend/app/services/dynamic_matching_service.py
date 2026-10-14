from app.api import errors
from app.models.allocation import AllocationStatus
from app.models.common import utc_now
from app.models.donation import DonationStatus
from app.models.events import Event
from app.models.offer import OfferStatus
from app.repositories.memory import InMemoryRepository
from app.services.offer_service import OfferService
from app.services.plan_service import PlanService
from app.utils.ids import new_id


class DynamicMatchingService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def refresh_for_recipient(self, recipient_id: str) -> int:
        recipient = self.repository.get_recipient(recipient_id)
        if recipient is None:
            return 0
        refreshed_count = 0
        for donation in self.repository.list_all_donations():
            if donation.usable_until <= utc_now():
                continue
            allocations = self.repository.list_allocations_for_donation(
                donation.donation_id
            )
            offers = self.repository.list_offers_for_donation(donation.donation_id)
            active_offer = next(
                (
                    offer
                    for offer in reversed(offers)
                    if offer.status == OfferStatus.PENDING
                ),
                None,
            )
            active_allocation = (
                self.repository.get_allocation(active_offer.allocation_id)
                if active_offer
                else None
            )
            profile_affects_offer = (
                active_allocation is not None
                and active_allocation.recipient_id == recipient_id
            )
            is_open_pending = (
                donation.status == DonationStatus.OPEN and donation.plan_id is None
            )
            if not profile_affects_offer and not is_open_pending:
                continue
            if any(
                allocation.status
                in {AllocationStatus.ACCEPTED, AllocationStatus.DELIVERED}
                or allocation.confirmed_quantity > 0
                for allocation in allocations
            ):
                continue

            if profile_affects_offer:
                for offer in offers:
                    if offer.status == OfferStatus.PENDING:
                        if self.repository.update_offer(
                            offer.offer_id,
                            status=OfferStatus.CANCELLED,
                            decision_reason="Recipient availability changed",
                            transition_count=offer.transition_count + 1,
                        ) is None:
                            raise errors.SecondServeError(
                                409,
                                "DYNAMIC_MATCH_CANCEL_FAILED",
                                "The stale offer could not be cancelled safely.",
                            )
                for allocation in allocations:
                    if allocation.status in {
                        AllocationStatus.PLANNED,
                        AllocationStatus.OFFERING,
                    }:
                        if self.repository.update_allocation(
                            allocation.allocation_id,
                            status=AllocationStatus.CANCELLED,
                            handoff_code_hash=None,
                        ) is None:
                            raise errors.SecondServeError(
                                409,
                                "DYNAMIC_MATCH_ALLOCATION_CANCEL_FAILED",
                                "A stale recipient allocation could not be cancelled safely.",
                            )
                        self.repository.delete_handoff_code(allocation.allocation_id)
                updated_donation = self.repository.update_donation(
                    donation.donation_id,
                    status=DonationStatus.OPEN,
                    plan_id=None,
                    handoff_code_hash=None,
                )
                if updated_donation is None:
                    raise errors.SecondServeError(
                        409,
                        "DYNAMIC_MATCH_DONATION_UPDATE_FAILED",
                        "The donation could not be reopened for matching.",
                    )
                self.repository.add_event(
                    donation.donation_id,
                    Event(
                        event_id=new_id("evt"),
                        actor_id=recipient.organization_id,
                        event_type="DYNAMIC_REMATCH_TRIGGERED",
                        occurred_at=utc_now(),
                        payload={"recipientId": recipient_id},
                    ),
                )

            refreshed = self.repository.get_donation(donation.donation_id)
            if refreshed is None:
                continue
            plan = PlanService(self.repository).create(
                refreshed,
                refreshed.donor_organization_id,
            )
            if plan.status.value in {"FULL", "PARTIAL"}:
                OfferService(self.repository).start_first_offer(
                    plan.plan_id,
                    refreshed.donor_organization_id,
                )
            refreshed_count += 1
        return refreshed_count

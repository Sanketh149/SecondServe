from hmac import compare_digest

from app.api import errors
from app.models.allocation import AllocationStatus
from app.models.common import utc_now
from app.models.donation import DonationStatus
from app.models.events import Event
from app.models.receipt import Receipt, ReceiptRequest
from app.repositories.memory import InMemoryRepository
from app.services.offer_service import OfferService
from app.utils.ids import new_id
from app.utils.security import hash_handoff_code


class ReceiptService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def submit(self, allocation_id: str, request: ReceiptRequest, recipient_organization_id: str) -> Receipt:
        allocation = self.repository.get_allocation(allocation_id)
        if allocation is None:
            raise errors.SecondServeError(404, "ALLOCATION_NOT_FOUND", "The allocation was not found.")
        if allocation.recipient_id not in self._recipient_ids_for_organization(recipient_organization_id):
            raise errors.SecondServeError(403, "FORBIDDEN", "The recipient cannot submit this receipt.")
        if allocation.status != AllocationStatus.ACCEPTED:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_ACCEPTED", "The allocation must be accepted before a receipt can be submitted.")
        if not allocation.handoff_code_hash or not compare_digest(
            allocation.handoff_code_hash,
            hash_handoff_code(request.handoff_code),
        ):
            raise errors.SecondServeError(422, "INVALID_HANDOFF_CODE", "The handoff code is invalid.")
        if request.quantity_received > allocation.quantity - allocation.confirmed_quantity:
            raise errors.SecondServeError(422, "INVALID_RECEIPT_QUANTITY", "The confirmed quantity exceeds the remaining allocation.")
        existing = self.repository.get_receipt_by_handoff(hash_handoff_code(request.handoff_code))
        if existing is not None:
            raise errors.SecondServeError(409, "HANDOFF_CODE_REUSED", "The handoff code has already been used.")
        now = utc_now()
        receipt = Receipt(
            receipt_id=new_id("rc"), allocation_id=allocation_id, donation_id=allocation.donation_id,
            recipient_organization_id=recipient_organization_id, quantity_received=request.quantity_received,
            confirmed_at=now, handoff_code_hash=hash_handoff_code(request.handoff_code),
            exception_reason=request.exception_reason, created_at=now, updated_at=now,
        )
        self.repository.create_receipt(receipt)
        self.repository.update_allocation(
            allocation_id,
            confirmed_quantity=allocation.confirmed_quantity + request.quantity_received,
            status=AllocationStatus.DELIVERED,
            handoff_code_hash=None,
        )
        self.repository.delete_handoff_code(allocation_id)
        donation = self.repository.get_donation(allocation.donation_id)
        if donation is not None:
            confirmed = donation.confirmed_quantity + request.quantity_received
            self.repository.update_donation(donation.donation_id, confirmed_quantity=confirmed)
            self.repository.add_event(
                donation.donation_id,
                Event(
                    event_id=new_id("evt"),
                    actor_id=recipient_organization_id,
                    event_type="RECEIPT_CONFIRMED",
                    occurred_at=now,
                    payload={
                        "receiptId": receipt.receipt_id,
                        "allocationId": allocation_id,
                        "quantityReceived": request.quantity_received,
                    },
                ),
            )
            next_offer = OfferService(self.repository).start_next_planned_offer(
                allocation.plan_id
            )
            if next_offer is not None:
                status = DonationStatus.OFFERING
            elif any(
                item.status == AllocationStatus.ACCEPTED
                for item in self.repository.list_allocations_for_donation(donation.donation_id)
            ):
                status = DonationStatus.ACCEPTED
            elif confirmed >= donation.quantity:
                status = DonationStatus.RESCUED
            else:
                status = DonationStatus.PARTIALLY_RESCUED
            self.repository.update_donation(donation.donation_id, status=status)
        return receipt

    def _recipient_ids_for_organization(self, organization_id: str) -> list[str]:
        return [
            recipient.recipient_id
            for recipient in self.repository.list_recipients()
            if recipient.organization_id == organization_id
        ]

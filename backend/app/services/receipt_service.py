from datetime import datetime

from app.api import errors
from app.models.allocation import Allocation, AllocationStatus
from app.models.donation import Donation, DonationStatus
from app.models.offer import OfferStatus
from app.models.receipt import Receipt, ReceiptRequest
from app.repositories.memory import InMemoryRepository
from app.utils.ids import new_id
from app.utils.security import generate_handoff_code, hash_handoff_code
from app.utils.time import as_utc


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
        if request.quantity_received > allocation.quantity - allocation.confirmed_quantity:
            raise errors.SecondServeError(422, "INVALID_RECEIPT_QUANTITY", "The confirmed quantity exceeds the remaining allocation.")
        existing = self.repository.get_receipt_by_handoff(hash_handoff_code(request.handoff_code))
        if existing is not None:
            raise errors.SecondServeError(409, "HANDOFF_CODE_REUSED", "The handoff code has already been used.")
        now = as_utc(datetime.now())
        receipt = Receipt(
            receipt_id=new_id("rc"), allocation_id=allocation_id, donation_id=allocation.donation_id,
            recipient_organization_id=recipient_organization_id, quantity_received=request.quantity_received,
            confirmed_at=now, handoff_code_hash=hash_handoff_code(request.handoff_code),
            exception_reason=request.exception_reason, created_at=now, updated_at=now,
        )
        self.repository.create_receipt(receipt)
        remaining = allocation.quantity - allocation.confirmed_quantity - request.quantity_received
        allocation_status = AllocationStatus.DELIVERED if remaining == 0 else AllocationStatus.ACCEPTED
        self.repository.update_allocation(allocation_id, confirmed_quantity=allocation.confirmed_quantity + request.quantity_received, status=allocation_status)
        donation = self.repository.get_donation(allocation.donation_id)
        if donation is not None:
            confirmed = donation.confirmed_quantity + request.quantity_received
            status = DonationStatus.RESCUED if confirmed == donation.quantity else DonationStatus.PARTIALLY_RESCUED
            self.repository.update_donation(donation.donation_id, confirmed_quantity=confirmed, status=status)
        return receipt

    def _recipient_ids_for_organization(self, organization_id: str) -> list[str]:
        return [
            recipient.recipient_id
            for recipient in self.repository.list_recipients()
            if recipient.organization_id == organization_id
        ]

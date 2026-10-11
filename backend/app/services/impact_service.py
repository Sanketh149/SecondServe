from app.models.donation import Donation
from app.models.receipt import Receipt
from app.repositories.memory import InMemoryRepository


class ImpactService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def summary(self, organization_id: str) -> dict:
        receipts = [
            receipt
            for receipt in self.repository.receipts.values()
            if receipt.recipient_organization_id == organization_id
        ]
        return {
            "confirmed_quantity": sum(receipt.quantity_received for receipt in receipts),
            "receipts_count": len(receipts),
            "donations_rescued": len({receipt.donation_id for receipt in receipts}),
        }

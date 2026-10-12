from __future__ import annotations

from functools import lru_cache
from typing import Any, TypeVar

from cryptography.fernet import Fernet, InvalidToken
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.client import Client

from app.api import errors
from app.config import get_settings
from app.models.allocation import Allocation
from app.models.analysis import FoodAnalysis
from app.models.donation import Donation
from app.models.events import Event
from app.models.offer import Offer
from app.models.organization import Organization
from app.models.receipt import Receipt
from app.models.recipient import Recipient
from app.models.rescue_plan import RescuePlan
from app.models.user import UserProfile
from app.utils.security import hash_handoff_code

ModelT = TypeVar("ModelT")

COLLECTIONS = {
    "users": ("users", UserProfile, "uid"),
    "organizations": ("organizations", Organization, "organizationId"),
    "recipients": ("recipients", Recipient, "recipientId"),
    "analyses": ("analyses", FoodAnalysis, "analysisId"),
    "donations": ("donations", Donation, "donationId"),
    "plans": ("rescuePlans", RescuePlan, "planId"),
    "allocations": ("allocations", Allocation, "allocationId"),
    "offers": ("offers", Offer, "offerId"),
    "receipts": ("receipts", Receipt, "receiptId"),
    "events": ("events", Event, "eventId"),
}


class FirestoreRepository:
    def __init__(self, client: Client | None = None) -> None:
        settings = get_settings()
        self.client = client or firestore.Client(
            project=settings.firestore_project_id,
            database=settings.firestore_database,
        )
        self.settings = settings

    def _collection(self, name: str):
        return self.client.collection(COLLECTIONS[name][0])

    @staticmethod
    def _document_data(model: Any) -> dict[str, Any]:
        data = model.model_dump(mode="json", by_alias=True)
        for field in ("handoffCodeHash", "handoff_code_hash"):
            value = getattr(model, "handoff_code_hash", None)
            if value:
                data["handoffCodeHash"] = value
                break
        return data

    def _get(self, name: str, identifier: str):
        collection, model_type, _ = COLLECTIONS[name]
        snapshot = self.client.collection(collection).document(identifier).get()
        if not snapshot.exists:
            return None
        return model_type.model_validate(snapshot.to_dict())

    def _create(self, name: str, model: ModelT) -> ModelT:
        collection, _, id_field = COLLECTIONS[name]
        attribute = "".join(
            f"_{character.lower()}" if character.isupper() else character
            for character in id_field
        )
        identifier = getattr(model, attribute)
        self.client.collection(collection).document(identifier).create(
            self._document_data(model)
        )
        return model

    def _update(self, name: str, identifier: str, **changes: Any):
        collection, _, _ = COLLECTIONS[name]
        reference = self.client.collection(collection).document(identifier)
        snapshot = reference.get()
        if not snapshot.exists:
            return None
        data = snapshot.to_dict()
        for key, value in changes.items():
            alias = "".join(
                part.capitalize() if index else part
                for index, part in enumerate(key.split("_"))
            )
            data[alias] = value.value if hasattr(value, "value") else value
        from app.models.common import utc_now

        data["updatedAt"] = utc_now().isoformat()
        reference.set(data)
        return self._get(name, identifier)

    def _list(
        self,
        name: str,
        field: str | None = None,
        value: Any = None,
    ) -> list[Any]:
        collection, model_type, _ = COLLECTIONS[name]
        query = self.client.collection(collection)
        if field is not None:
            query = query.where(filter=FieldFilter(field, "==", value))
        return [
            model_type.model_validate(snapshot.to_dict())
            for snapshot in query.stream()
        ]

    def get_user(self, uid: str) -> UserProfile | None:
        return self._get("users", uid)

    def create_user(self, user: UserProfile) -> UserProfile:
        return self._create("users", user)

    def get_organization(self, organization_id: str) -> Organization | None:
        return self._get("organizations", organization_id)

    def create_organization(self, organization: Organization) -> Organization:
        return self._create("organizations", organization)

    def get_recipient(self, recipient_id: str) -> Recipient | None:
        return self._get("recipients", recipient_id)

    def create_recipient(self, recipient: Recipient) -> Recipient:
        return self._create("recipients", recipient)

    def create_organization_profile(
        self,
        organization: Organization,
        user: UserProfile,
        recipient: Recipient | None,
    ) -> UserProfile:
        transaction = self.client.transaction()
        user_reference = self.client.collection("users").document(user.uid)
        organization_reference = self.client.collection("organizations").document(
            organization.organization_id
        )
        recipient_reference = (
            self.client.collection("recipients").document(recipient.recipient_id)
            if recipient is not None
            else None
        )

        @firestore.transactional
        def create_documents(transaction):
            user_snapshot = next(transaction.get(user_reference))
            if user_snapshot.exists:
                raise ValueError("User profile already exists")
            transaction.create(user_reference, self._document_data(user))
            transaction.create(
                organization_reference,
                self._document_data(organization),
            )
            if recipient is not None and recipient_reference is not None:
                transaction.create(
                    recipient_reference,
                    self._document_data(recipient),
                )

        create_documents(transaction)
        return user

    def list_recipients(self) -> list[Recipient]:
        return self._list("recipients")

    def create_analysis(self, analysis: FoodAnalysis) -> FoodAnalysis:
        return self._create("analyses", analysis)

    def get_analysis(self, analysis_id: str) -> FoodAnalysis | None:
        return self._get("analyses", analysis_id)

    def update_analysis(self, analysis_id: str, **changes: Any) -> FoodAnalysis | None:
        return self._update("analyses", analysis_id, **changes)

    def create_donation(self, donation: Donation) -> Donation:
        self._create("donations", donation)
        self.add_event(
            donation.donation_id,
            Event(
                event_id=f"evt-{donation.donation_id}",
                actor_id=donation.donor_organization_id,
                event_type="DONATION_CREATED",
                occurred_at=donation.created_at,
                payload={"donationId": donation.donation_id},
            ),
        )
        return donation

    def get_donation(self, donation_id: str) -> Donation | None:
        return self._get("donations", donation_id)

    def list_donations(self, organization_id: str) -> list[Donation]:
        return self._list("donations", "donorOrganizationId", organization_id)

    def list_all_donations(self) -> list[Donation]:
        return self._list("donations")

    def list_donations_for_recipient(self, recipient_id: str) -> list[Donation]:
        allocations = self._list("allocations", "recipientId", recipient_id)
        donation_ids = {allocation.donation_id for allocation in allocations}
        return [
            donation
            for donation_id in donation_ids
            if (donation := self.get_donation(donation_id)) is not None
        ]

    def list_allocations_for_donation(self, donation_id: str) -> list[Allocation]:
        return self._list("allocations", "donationId", donation_id)

    def list_allocations_for_plan(self, plan_id: str) -> list[Allocation]:
        return self._list("allocations", "planId", plan_id)

    def list_offers_for_donation(self, donation_id: str) -> list[Offer]:
        return self._list("offers", "donationId", donation_id)

    def update_donation(self, donation_id: str, **changes: Any) -> Donation | None:
        return self._update("donations", donation_id, **changes)

    def create_plan(self, plan: RescuePlan) -> RescuePlan:
        return self._create("plans", plan)

    def get_plan(self, plan_id: str) -> RescuePlan | None:
        return self._get("plans", plan_id)

    def create_allocation(self, allocation: Allocation) -> Allocation:
        return self._create("allocations", allocation)

    def get_allocation(self, allocation_id: str) -> Allocation | None:
        return self._get("allocations", allocation_id)

    def update_allocation(self, allocation_id: str, **changes: Any) -> Allocation | None:
        return self._update("allocations", allocation_id, **changes)

    def create_offer(self, offer: Offer) -> Offer:
        return self._create("offers", offer)

    def get_offer(self, offer_id: str) -> Offer | None:
        return self._get("offers", offer_id)

    def update_offer(self, offer_id: str, **changes: Any) -> Offer | None:
        return self._update("offers", offer_id, **changes)

    def list_offers_for_recipient(self, recipient_id: str) -> list[Offer]:
        return self._list("offers", "recipientId", recipient_id)

    def create_receipt(self, receipt: Receipt) -> Receipt:
        return self._create("receipts", receipt)

    def set_handoff_code(self, allocation_id: str, code: str) -> None:
        if not self.settings.handoff_encryption_key:
            raise errors.SecondServeError(
                503,
                "HANDOFF_ENCRYPTION_NOT_CONFIGURED",
                "Secure handoff-code storage is not configured.",
            )
        try:
            cipher = Fernet(self.settings.handoff_encryption_key.encode())
            encrypted_code = cipher.encrypt(code.encode()).decode()
        except (ValueError, TypeError) as exc:
            raise errors.SecondServeError(
                503,
                "HANDOFF_ENCRYPTION_NOT_CONFIGURED",
                "The handoff-code encryption key is invalid.",
            ) from exc
        self.client.collection("handoffCodes").document(allocation_id).set(
            {
                "allocationId": allocation_id,
                "encryptedCode": encrypted_code,
                "codeHash": hash_handoff_code(code),
            }
        )

    def get_handoff_code(self, allocation_id: str) -> str | None:
        snapshot = self.client.collection("handoffCodes").document(allocation_id).get()
        if not snapshot.exists:
            return None
        if not self.settings.handoff_encryption_key:
            raise errors.SecondServeError(
                503,
                "HANDOFF_ENCRYPTION_NOT_CONFIGURED",
                "Secure handoff-code storage is not configured.",
            )
        try:
            cipher = Fernet(self.settings.handoff_encryption_key.encode())
            return cipher.decrypt(snapshot.to_dict()["encryptedCode"].encode()).decode()
        except (InvalidToken, ValueError, KeyError) as exc:
            raise errors.SecondServeError(
                500,
                "HANDOFF_CODE_DECRYPTION_FAILED",
                "The handoff code could not be securely retrieved.",
            ) from exc

    def delete_handoff_code(self, allocation_id: str) -> None:
        self.client.collection("handoffCodes").document(allocation_id).delete()

    def get_receipt_by_handoff(self, handoff_code_hash: str) -> Receipt | None:
        receipts = self._list("receipts", "handoffCodeHash", handoff_code_hash)
        return receipts[0] if receipts else None

    def get_impact(self, organization_id: str) -> dict[str, Any]:
        owned = self.list_donations(organization_id)
        owned_ids = {donation.donation_id for donation in owned}
        receipts = self._list("receipts", "recipientOrganizationId", organization_id)
        donor_receipts = [
            receipt
            for donation_id in owned_ids
            for receipt in self._list("receipts", "donationId", donation_id)
        ]
        all_receipts = {receipt.receipt_id: receipt for receipt in [*receipts, *donor_receipts]}
        return {
            "confirmed_quantity": sum(donation.confirmed_quantity for donation in owned)
            if owned
            else sum(receipt.quantity_received for receipt in receipts),
            "receipts_count": len(all_receipts),
            "period": "all-time",
        }

    def add_event(self, donation_id: str, event: Event) -> Event:
        if event.donation_id != donation_id:
            event = event.model_copy(update={"donation_id": donation_id})
        self._create("events", event)
        return event

    def list_events(self, donation_id: str) -> list[Event]:
        return self._list("events", "donationId", donation_id)


@lru_cache(maxsize=1)
def get_firestore_repository() -> FirestoreRepository:
    return FirestoreRepository()

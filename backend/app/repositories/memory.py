from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

from app.models.allocation import Allocation
from app.models.analysis import FoodAnalysis
from app.models.common import Role, utc_now
from app.models.donation import Donation
from app.models.events import Event
from app.models.offer import Offer
from app.models.organization import Organization
from app.models.receipt import Receipt
from app.models.recipient import Recipient
from app.models.rescue_plan import RescuePlan
from app.models.user import UserProfile


class InMemoryRepository:
    def __init__(self) -> None:
        self.users: dict[str, UserProfile] = {}
        self.organizations: dict[str, Organization] = {}
        self.recipients: dict[str, Recipient] = {}
        self.analyses: dict[str, FoodAnalysis] = {}
        self.donations: dict[str, Donation] = {}
        self.plans: dict[str, RescuePlan] = {}
        self.allocations: dict[str, Allocation] = {}
        self.offers: dict[str, Offer] = {}
        self.receipts: dict[str, Receipt] = {}
        self.events: dict[str, list[Event]] = {}
        self.handoff_codes: dict[str, str] = {}

    def initialize_demo_data(self) -> None:
        if self.users:
            return
        now = utc_now()
        self.organizations.update({
            "org-green-leaf": Organization(organization_id="org-green-leaf", name="Green Leaf Kitchen", type="donor", location={"latitude": 40.7128, "longitude": -74.0060}, address="18 Market Street", created_at=now, updated_at=now),
            "org-hope-shelter": Organization(organization_id="org-hope-shelter", name="Hope Shelter", type="recipient", location={"latitude": 40.7140, "longitude": -74.0090}, address="42 Harbor Lane", created_at=now, updated_at=now),
            "org-community-kitchen": Organization(organization_id="org-community-kitchen", name="Community Kitchen", type="recipient", location={"latitude": 40.7160, "longitude": -74.0070}, address="7 Garden Place", created_at=now, updated_at=now),
            "org-neighborhood-pantry": Organization(organization_id="org-neighborhood-pantry", name="Neighborhood Pantry", type="recipient", location={"latitude": 40.7190, "longitude": -74.0040}, address="109 Cedar Avenue", created_at=now, updated_at=now),
        })
        self.users.update({
            "demo-donor": UserProfile(uid="demo-donor", display_name="Green Leaf Demo", role=Role.DONOR, organization_id="org-green-leaf", created_at=now, updated_at=now),
            "demo-hope": UserProfile(uid="demo-hope", display_name="Hope Shelter Demo", role=Role.RECIPIENT, organization_id="org-hope-shelter", created_at=now, updated_at=now),
            "demo-community": UserProfile(uid="demo-community", display_name="Community Kitchen Demo", role=Role.RECIPIENT, organization_id="org-community-kitchen", created_at=now, updated_at=now),
            "demo-pantry": UserProfile(uid="demo-pantry", display_name="Neighborhood Pantry Demo", role=Role.RECIPIENT, organization_id="org-neighborhood-pantry", created_at=now, updated_at=now),
        })
        self.recipients.update({
            "rcp-hope": Recipient(recipient_id="rcp-hope", organization_id="org-hope-shelter", organization_name="Hope Shelter", active=True, location={"latitude": 40.7140, "longitude": -74.0090}, timezone="America/New_York", hours={"monday": [("09:00", "17:00")], "tuesday": [("09:00", "17:00")], "wednesday": [("09:00", "17:00")], "thursday": [("09:00", "17:00")], "friday": [("09:00", "17:00")], "saturday": [("09:00", "17:00")], "sunday": []}, capacity=24, unmet_demand=24, accepted_categories=["prepared_meal"], dietary_tags=["vegetarian"], allergen_restrictions=["peanut"], confirmed_deliveries=[], created_at=now, updated_at=now),
            "rcp-community": Recipient(recipient_id="rcp-community", organization_id="org-community-kitchen", organization_name="Community Kitchen", active=True, location={"latitude": 40.7160, "longitude": -74.0070}, timezone="America/New_York", hours={"monday": [("09:00", "17:00")], "tuesday": [("09:00", "17:00")], "wednesday": [("09:00", "17:00")], "thursday": [("09:00", "17:00")], "friday": [("09:00", "17:00")], "saturday": [("09:00", "17:00")], "sunday": []}, capacity=8, unmet_demand=8, accepted_categories=["prepared_meal"], dietary_tags=["vegetarian"], allergen_restrictions=[], confirmed_deliveries=[], created_at=now, updated_at=now),
            "rcp-pantry": Recipient(recipient_id="rcp-pantry", organization_id="org-neighborhood-pantry", organization_name="Neighborhood Pantry", active=True, location={"latitude": 40.7190, "longitude": -74.0040}, timezone="America/New_York", hours={"monday": [("09:00", "17:00")], "tuesday": [("09:00", "17:00")], "wednesday": [("09:00", "17:00")], "thursday": [("09:00", "17:00")], "friday": [("09:00", "17:00")], "saturday": [("09:00", "17:00")], "sunday": []}, capacity=4, unmet_demand=4, accepted_categories=["prepared_meal"], dietary_tags=["vegetarian"], allergen_restrictions=[], confirmed_deliveries=[], created_at=now, updated_at=now),
        })

    def get_user(self, uid: str) -> UserProfile | None:
        return deepcopy(self.users.get(uid))

    def create_user(self, user: UserProfile) -> UserProfile:
        self.users[user.uid] = user
        return deepcopy(user)

    def create_organization(self, organization: Organization) -> Organization:
        self.organizations[organization.organization_id] = organization
        return deepcopy(organization)

    def create_recipient(self, recipient: Recipient) -> Recipient:
        self.recipients[recipient.recipient_id] = recipient
        return deepcopy(recipient)

    def update_recipient(self, recipient_id: str, **changes: Any) -> Recipient | None:
        recipient = self.recipients.get(recipient_id)
        if recipient is None:
            return None
        for key, value in changes.items():
            setattr(recipient, key, value)
        recipient.updated_at = utc_now()
        return deepcopy(recipient)

    def create_organization_profile(
        self,
        organization: Organization,
        user: UserProfile,
        recipient: Recipient | None,
    ) -> UserProfile:
        if user.uid in self.users:
            raise ValueError("User profile already exists")
        self.create_organization(organization)
        if recipient is not None:
            self.create_recipient(recipient)
        return self.create_user(user)

    def get_organization(self, organization_id: str) -> Organization | None:
        return deepcopy(self.organizations.get(organization_id))

    def list_all_organizations(self) -> list[Organization]:
        return deepcopy(list(self.organizations.values()))

    def get_recipient(self, recipient_id: str) -> Recipient | None:
        return deepcopy(self.recipients.get(recipient_id))

    def list_recipients(self) -> list[Recipient]:
        return deepcopy(list(self.recipients.values()))

    def create_analysis(self, analysis: FoodAnalysis) -> FoodAnalysis:
        self.analyses[analysis.analysis_id] = analysis
        return deepcopy(analysis)

    def get_analysis(self, analysis_id: str) -> FoodAnalysis | None:
        return deepcopy(self.analyses.get(analysis_id))

    def update_analysis(self, analysis_id: str, **changes: Any) -> FoodAnalysis | None:
        analysis = self.analyses.get(analysis_id)
        if analysis is None:
            return None
        for key, value in changes.items():
            setattr(analysis, key, value)
        analysis.updated_at = utc_now()
        return deepcopy(analysis)

    def create_donation(self, donation: Donation) -> Donation:
        self.donations[donation.donation_id] = donation
        self.events.setdefault(donation.donation_id, []).append(Event(event_id=f"evt-{uuid4()}", actor_id=donation.donor_organization_id, event_type="DONATION_CREATED", occurred_at=donation.created_at, payload={"donationId": donation.donation_id}))
        return deepcopy(donation)

    def get_donation(self, donation_id: str) -> Donation | None:
        return deepcopy(self.donations.get(donation_id))

    def list_donations(self, organization_id: str) -> list[Donation]:
        return deepcopy([donation for donation in self.donations.values() if donation.donor_organization_id == organization_id])

    def list_all_donations(self) -> list[Donation]:
        return deepcopy(list(self.donations.values()))

    def list_all_allocations(self) -> list[Allocation]:
        return deepcopy(list(self.allocations.values()))

    def list_donations_for_recipient(self, recipient_id: str) -> list[Donation]:
        donation_ids = {
            allocation.donation_id
            for allocation in self.allocations.values()
            if allocation.recipient_id == recipient_id
        }
        return deepcopy([
            donation for donation in self.donations.values()
            if donation.donation_id in donation_ids
        ])

    def list_allocations_for_donation(self, donation_id: str) -> list[Allocation]:
        return deepcopy([item for item in self.allocations.values() if item.donation_id == donation_id])

    def list_allocations_for_plan(self, plan_id: str) -> list[Allocation]:
        return deepcopy([item for item in self.allocations.values() if item.plan_id == plan_id])

    def list_offers_for_donation(self, donation_id: str) -> list[Offer]:
        return deepcopy([item for item in self.offers.values() if item.donation_id == donation_id])

    def update_donation(self, donation_id: str, **changes: Any) -> Donation | None:
        donation = self.donations.get(donation_id)
        if donation is None:
            return None
        for key, value in changes.items():
            setattr(donation, key, value)
        donation.updated_at = utc_now()
        return deepcopy(donation)

    def create_plan(self, plan: RescuePlan) -> RescuePlan:
        self.plans[plan.plan_id] = plan
        return deepcopy(plan)

    def get_plan(self, plan_id: str) -> RescuePlan | None:
        return deepcopy(self.plans.get(plan_id))

    def create_allocation(self, allocation: Allocation) -> Allocation:
        self.allocations[allocation.allocation_id] = allocation
        return deepcopy(allocation)

    def get_allocation(self, allocation_id: str) -> Allocation | None:
        return deepcopy(self.allocations.get(allocation_id))

    def update_allocation(self, allocation_id: str, **changes: Any) -> Allocation | None:
        allocation = self.allocations.get(allocation_id)
        if allocation is None:
            return None
        for key, value in changes.items():
            setattr(allocation, key, value)
        allocation.updated_at = utc_now()
        return deepcopy(allocation)

    def create_offer(self, offer: Offer) -> Offer:
        self.offers[offer.offer_id] = offer
        return deepcopy(offer)

    def get_offer(self, offer_id: str) -> Offer | None:
        return deepcopy(self.offers.get(offer_id))

    def update_offer(self, offer_id: str, **changes: Any) -> Offer | None:
        offer = self.offers.get(offer_id)
        if offer is None:
            return None
        for key, value in changes.items():
            setattr(offer, key, value)
        offer.updated_at = utc_now()
        return deepcopy(offer)

    def list_offers_for_recipient(self, recipient_id: str) -> list[Offer]:
        return deepcopy([offer for offer in self.offers.values() if offer.recipient_id == recipient_id])

    def create_receipt(self, receipt: Receipt) -> Receipt:
        self.receipts[receipt.receipt_id] = receipt
        return deepcopy(receipt)

    def list_all_receipts(self) -> list[Receipt]:
        return deepcopy(list(self.receipts.values()))

    def list_receipts_for_recipient(self, organization_id: str) -> list[Receipt]:
        return deepcopy([
            receipt
            for receipt in self.receipts.values()
            if receipt.recipient_organization_id == organization_id
        ])

    def set_handoff_code(self, allocation_id: str, code: str) -> None:
        self.handoff_codes[allocation_id] = code

    def get_handoff_code(self, allocation_id: str) -> str | None:
        return self.handoff_codes.get(allocation_id)

    def delete_handoff_code(self, allocation_id: str) -> None:
        self.handoff_codes.pop(allocation_id, None)

    def get_receipt_by_handoff(self, handoff_code_hash: str) -> Receipt | None:
        return deepcopy(next((receipt for receipt in self.receipts.values() if receipt.handoff_code_hash == handoff_code_hash), None))

    def get_impact(self, organization_id: str) -> dict[str, Any]:
        owned_donations = [
            donation
            for donation in self.donations.values()
            if donation.donor_organization_id == organization_id
        ]
        donation_ids = {donation.donation_id for donation in owned_donations}
        receipts = [
            receipt
            for receipt in self.receipts.values()
            if receipt.recipient_organization_id == organization_id
            or receipt.donation_id in donation_ids
        ]
        if owned_donations:
            confirmed_weight = sum(
                (donation.estimated_total_weight_kg or 0)
                * donation.confirmed_quantity
                / donation.quantity
                for donation in owned_donations
                if donation.quantity > 0
            )
        else:
            confirmed_weight = sum(
                (donation.estimated_total_weight_kg or 0)
                * receipt.quantity_received
                / donation.quantity
                for receipt in receipts
                if (
                    (donation := self.donations.get(receipt.donation_id))
                    and donation.quantity > 0
                )
            )
        if owned_donations:
            return {
                "confirmed_quantity": sum(item.confirmed_quantity for item in owned_donations),
                "receipts_count": sum(item.donation_id in donation_ids for item in receipts),
                "period": "all-time",
                "donor_reported_confirmed_weight_kg": round(confirmed_weight, 3)
                if confirmed_weight > 0
                else None,
            }
        return {
            "confirmed_quantity": sum(receipt.quantity_received for receipt in receipts),
            "receipts_count": len(receipts),
            "period": "all-time",
            "donor_reported_confirmed_weight_kg": round(confirmed_weight, 3)
            if confirmed_weight > 0
            else None,
        }

    def add_event(self, donation_id: str, event: Event) -> Event:
        if event.donation_id != donation_id:
            event = event.model_copy(update={"donation_id": donation_id})
        self.events.setdefault(donation_id, []).append(event)
        return event

    def list_events(self, donation_id: str) -> list[Event]:
        return deepcopy([
            event
            for event in self.events.get(donation_id, [])
            if event.donation_id == donation_id
        ])


_memory_repository = InMemoryRepository()


def get_repository() -> InMemoryRepository:
    from app.config import get_settings

    settings = get_settings()
    if settings.demo_mode or settings.data_backend == "memory":
        return _memory_repository
    from app.repositories.firestore import get_firestore_repository

    return get_firestore_repository()


def initialize_demo_data() -> None:
    repository = get_repository()
    if isinstance(repository, InMemoryRepository):
        repository.initialize_demo_data()

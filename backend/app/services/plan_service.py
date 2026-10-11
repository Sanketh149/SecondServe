from __future__ import annotations

from app.models.allocation import Allocation, AllocationStatus
from app.models.common import utc_now
from app.models.donation import CreateDonationRequest, Donation, DonationStatus
from app.models.events import Event
from app.models.rescue_plan import RescuePlan
from app.repositories.memory import InMemoryRepository
from app.services.matching_service import MatchingService
from app.services.route_service import RouteService
from app.utils.ids import new_id
from app.utils.time import as_utc


class PlanService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def preview(
        self,
        request: CreateDonationRequest,
        donor_organization_id: str,
    ) -> RescuePlan:
        now = utc_now()
        donation = Donation(
            donation_id=new_id("preview"),
            donor_organization_id=donor_organization_id,
            item_name=request.item_name,
            category=request.category,
            quantity=request.quantity,
            unit=request.unit,
            dietary_tags=request.dietary_tags,
            declared_allergens=request.declared_allergens,
            allergen_status=request.allergen_status,
            prepared_at=as_utc(request.prepared_at),
            storage_condition=request.storage_condition,
            pickup_available_at=as_utc(request.pickup_available_at),
            usable_until=as_utc(request.usable_until),
            analysis_id=request.analysis_id,
            status=DonationStatus.OPEN,
            plan_id=None,
            confirmed_quantity=0,
            created_at=now,
            updated_at=now,
        )
        return MatchingService(self.repository, RouteService(self.repository)).build_plan(
            donation,
            donor_organization_id,
        )

    def create(self, donation: Donation, donor_organization_id: str) -> RescuePlan:
        plan = MatchingService(
            self.repository,
            RouteService(self.repository),
        ).build_plan(donation, donor_organization_id)
        self.repository.create_plan(plan)
        for plan_allocation in plan.allocations:
            fallback_ids = [
                str(candidate["recipientId"])
                for candidate in plan_allocation.fallback_candidates
                if candidate.get("recipientId")
            ]
            self.repository.create_allocation(
                Allocation(
                    allocation_id=plan_allocation.allocation_id,
                    plan_id=plan.plan_id,
                    donation_id=donation.donation_id,
                    recipient_id=plan_allocation.recipient_id,
                    quantity=plan_allocation.quantity,
                    status=AllocationStatus.PLANNED,
                    confirmed_quantity=0,
                    active_candidate_index=0,
                    assigned_candidate_ids=[
                        plan_allocation.recipient_id,
                        *fallback_ids,
                    ],
                    created_at=plan.created_at,
                    updated_at=plan.updated_at,
                )
            )
        if plan.status.value in {"FULL", "PARTIAL"}:
            self.repository.update_donation(
                donation.donation_id,
                plan_id=plan.plan_id,
                status=DonationStatus.PLANNED,
            )
        self.repository.add_event(
            donation.donation_id,
            Event(
                event_id=new_id("evt"),
                actor_id=donor_organization_id,
                event_type="RESCUE_PLAN_CREATED",
                occurred_at=plan.created_at,
                payload={
                    "planId": plan.plan_id,
                    "status": plan.status.value,
                    "allocatedQuantity": plan.allocated_quantity,
                    "unallocatedQuantity": plan.unallocated_quantity,
                },
            ),
        )
        return plan

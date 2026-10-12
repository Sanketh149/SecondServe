from __future__ import annotations

import json
import logging
from datetime import timedelta

from google.api_core.exceptions import AlreadyExists, GoogleAPICallError
from google.auth.exceptions import GoogleAuthError
from google.cloud import tasks_v2

from app.api import errors
from app.config import get_settings
from app.models.allocation import Allocation, AllocationStatus
from app.models.common import utc_now
from app.models.donation import DonationStatus
from app.models.events import Event
from app.models.offer import Offer, OfferStatus
from app.models.rescue_plan import PlanStatus
from app.repositories.memory import InMemoryRepository
from app.utils.ids import new_id
from app.utils.security import generate_handoff_code, hash_handoff_code

logger = logging.getLogger(__name__)


class OfferService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository
        self.ttl_minutes = get_settings().offer_ttl_minutes

    def start_first_offer(
        self,
        plan_id: str,
        donor_organization_id: str,
    ) -> tuple[Offer | None, str | None]:
        plan = self.repository.get_plan(plan_id)
        if plan is None:
            raise errors.SecondServeError(404, "PLAN_NOT_FOUND", "The rescue plan was not found.")
        if plan.status not in {PlanStatus.FULL, PlanStatus.PARTIAL}:
            raise errors.SecondServeError(409, "PLAN_NOT_STARTABLE", "The rescue plan cannot start an offer.")
        donation = self.repository.get_donation(plan.donation_id)
        if donation is None or donation.donor_organization_id != donor_organization_id:
            raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
        if donation.usable_until <= utc_now():
            raise errors.SecondServeError(409, "DONATION_EXPIRED", "The donation cutoff has passed.")
        if self.repository.list_offers_for_donation(donation.donation_id):
            raise errors.SecondServeError(409, "OFFER_ALREADY_STARTED", "An offer has already started for this rescue plan.")
        if not plan.allocations:
            raise errors.SecondServeError(409, "PLAN_HAS_NO_ALLOCATIONS", "The rescue plan has no eligible recipients.")
        allocation = self.repository.get_allocation(plan.allocations[0].allocation_id)
        if allocation is None or allocation.status != AllocationStatus.PLANNED:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_AVAILABLE", "The planned allocation is not available.")
        offer, code = self._start_allocation(allocation)
        self.repository.update_donation(
            donation.donation_id,
            status=DonationStatus.OFFERING,
            plan_id=plan.plan_id,
        )
        self._event(donation.donation_id, donor_organization_id, "OFFER_STARTED", {
            "offerId": offer.offer_id,
            "allocationId": allocation.allocation_id,
        })
        return offer, code

    def respond(
        self,
        offer_id: str,
        recipient_organization_id: str,
        decision: str,
        reason: str | None,
    ) -> Offer:
        offer = self.repository.get_offer(offer_id)
        if offer is None:
            raise errors.SecondServeError(404, "OFFER_NOT_FOUND", "The offer was not found.")
        allocation = self.repository.get_allocation(offer.allocation_id)
        if allocation is None:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_FOUND", "The allocation associated with this offer is missing.")
        recipient = self.repository.get_recipient(allocation.recipient_id)
        if recipient is None or recipient.organization_id != recipient_organization_id:
            raise errors.SecondServeError(403, "FORBIDDEN", "The offer is not assigned to this recipient.")
        if offer.status != OfferStatus.PENDING:
            raise errors.SecondServeError(409, "OFFER_NOT_PENDING", "The offer has already transitioned.")
        if offer.expires_at <= utc_now():
            self.expire(offer_id)
            raise errors.SecondServeError(409, "OFFER_EXPIRED", "The response window has expired; the offer was relayed.")
        if decision not in {"ACCEPT", "DECLINE"}:
            raise errors.SecondServeError(422, "INVALID_DECISION", "The decision must be ACCEPT or DECLINE.")

        status = OfferStatus.ACCEPTED if decision == "ACCEPT" else OfferStatus.DECLINED
        updated_offer = self.repository.update_offer(
            offer.offer_id,
            status=status,
            decision_reason=reason,
            transition_count=offer.transition_count + 1,
        )
        if updated_offer is None:
            raise errors.SecondServeError(409, "OFFER_NOT_FOUND", "The offer could not be updated.")

        if decision == "ACCEPT":
            self.repository.update_allocation(allocation.allocation_id, status=AllocationStatus.ACCEPTED)
            self.repository.update_donation(offer.donation_id, status=DonationStatus.ACCEPTED)
            self._event(offer.donation_id, recipient_organization_id, "OFFER_ACCEPTED", {
                "offerId": offer.offer_id,
                "allocationId": allocation.allocation_id,
            })
            return updated_offer

        self._event(offer.donation_id, recipient_organization_id, "OFFER_DECLINED", {
            "offerId": offer.offer_id,
            "allocationId": allocation.allocation_id,
            "reason": reason,
        })
        fallback_offer = self._advance_fallback(allocation)
        if fallback_offer is None:
            self.repository.update_allocation(allocation.allocation_id, status=AllocationStatus.UNASSIGNED)
            fallback_offer = self.start_next_planned_offer(allocation.plan_id)
        self._update_donation_after_transition(offer.donation_id, fallback_offer)
        return updated_offer

    def start_next_planned_offer(self, plan_id: str) -> Offer | None:
        plan = self.repository.get_plan(plan_id)
        if plan is None:
            return None
        for allocation_plan in plan.allocations:
            allocation = self.repository.get_allocation(allocation_plan.allocation_id)
            if allocation and allocation.status == AllocationStatus.PLANNED:
                offer, _ = self._start_allocation(allocation)
                self._event(allocation.donation_id, "system", "OFFER_RELAYED", {
                    "offerId": offer.offer_id,
                    "allocationId": allocation.allocation_id,
                })
                return offer
        return None

    def expire(self, offer_id: str) -> Offer:
        offer = self.repository.get_offer(offer_id)
        if offer is None:
            raise errors.SecondServeError(404, "OFFER_NOT_FOUND", "The offer was not found.")
        if offer.status != OfferStatus.PENDING:
            return offer
        if offer.expires_at > utc_now():
            raise errors.SecondServeError(409, "OFFER_NOT_EXPIRED", "The offer response window is still active.")
        allocation = self.repository.get_allocation(offer.allocation_id)
        updated_offer = self.repository.update_offer(
            offer.offer_id,
            status=OfferStatus.EXPIRED,
            transition_count=offer.transition_count + 1,
        )
        if allocation is not None:
            fallback_offer = self._advance_fallback(allocation)
            if fallback_offer is None:
                self.repository.update_allocation(allocation.allocation_id, status=AllocationStatus.EXPIRED)
                fallback_offer = self.start_next_planned_offer(allocation.plan_id)
            self._update_donation_after_transition(offer.donation_id, fallback_offer)
        self._event(offer.donation_id, "system", "OFFER_EXPIRED", {
            "offerId": offer.offer_id,
            "allocationId": offer.allocation_id,
        })
        if updated_offer is None:
            raise errors.SecondServeError(409, "OFFER_NOT_FOUND", "The offer could not be updated.")
        return updated_offer

    def _start_allocation(self, allocation: Allocation) -> tuple[Offer, str]:
        now = utc_now()
        code = generate_handoff_code()
        updated = self.repository.update_allocation(
            allocation.allocation_id,
            status=AllocationStatus.OFFERING,
            handoff_code_hash=hash_handoff_code(code),
            assigned_candidate_ids=allocation.assigned_candidate_ids or [allocation.recipient_id],
        )
        if updated is None:
            raise errors.SecondServeError(409, "ALLOCATION_NOT_FOUND", "The allocation could not be activated.")
        self.repository.set_handoff_code(allocation.allocation_id, code)
        offer = Offer(
            offer_id=new_id("of"),
            allocation_id=allocation.allocation_id,
            donation_id=allocation.donation_id,
            recipient_id=updated.recipient_id,
            status=OfferStatus.PENDING,
            expires_at=now + timedelta(minutes=self.ttl_minutes),
            decision_reason=None,
            transition_count=1,
            created_at=now,
            updated_at=now,
        )
        created_offer = self.repository.create_offer(offer)
        try:
            expiry_scheduled = self._schedule_expiration(created_offer)
            if expiry_scheduled:
                updated_offer = self.repository.update_offer(
                    created_offer.offer_id,
                    expiry_scheduled=True,
                )
                if updated_offer is None:
                    raise errors.SecondServeError(
                        500,
                        "OFFER_EXPIRY_STATUS_SAVE_FAILED",
                        "The offer expiry status could not be saved.",
                    )
                created_offer = updated_offer
        except Exception:
            self.repository.update_offer(
                created_offer.offer_id,
                status=OfferStatus.CANCELLED,
            )
            self.repository.update_allocation(
                allocation.allocation_id,
                status=AllocationStatus.PLANNED,
                handoff_code_hash=None,
            )
            self.repository.delete_handoff_code(allocation.allocation_id)
            raise
        return created_offer, code

    def _schedule_expiration(self, offer: Offer) -> bool:
        settings = get_settings()
        if settings.demo_mode:
            return False
        required = {
            "cloud_tasks_project_id": settings.cloud_tasks_project_id,
            "cloud_tasks_location": settings.cloud_tasks_location,
            "cloud_tasks_service_url": settings.cloud_tasks_service_url,
            "cloud_tasks_service_account": settings.cloud_tasks_service_account,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            if settings.environment == "local":
                logger.warning(
                    "Offer %s has no automatic expiry callback in local mode; "
                    "responses after the deadline will trigger expiry handling",
                    offer.offer_id,
                )
                return False
            raise errors.SecondServeError(
                503,
                "CLOUD_TASKS_NOT_CONFIGURED",
                "Offer expiry is not configured; no offer was started.",
                {"missingSettings": missing},
            )
        try:
            client = tasks_v2.CloudTasksClient()
            queue_path = client.queue_path(
                settings.cloud_tasks_project_id,
                settings.cloud_tasks_location,
                settings.cloud_tasks_queue,
            )
            task_name = f"{queue_path}/tasks/expire-{offer.offer_id}"
            service_url = settings.cloud_tasks_service_url.rstrip("/")
            task = {
                "name": task_name,
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": f"{service_url}/api/v1/internal/offers/{offer.offer_id}/expire",
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"offerId": offer.offer_id}).encode(),
                    "oidc_token": {
                        "service_account_email": settings.cloud_tasks_service_account,
                        "audience": service_url,
                    },
                },
                "schedule_time": offer.expires_at,
            }
            client.create_task(request={"parent": queue_path, "task": task})
            return True
        except AlreadyExists:
            logger.info("Expiry task already exists for offer %s", offer.offer_id)
            return True
        except (GoogleAPICallError, GoogleAuthError) as exc:
            logger.exception("Could not schedule expiry for offer %s", offer.offer_id)
            raise errors.SecondServeError(
                503,
                "CLOUD_TASK_SCHEDULING_FAILED",
                "The offer expiry could not be scheduled; no offer was started.",
            ) from exc

    def _advance_fallback(self, allocation: Allocation) -> Offer | None:
        candidates = allocation.assigned_candidate_ids or [allocation.recipient_id]
        next_index = allocation.active_candidate_index + 1
        while next_index < len(candidates):
            recipient = self.repository.get_recipient(candidates[next_index])
            if (
                recipient
                and recipient.active
                and recipient.capacity >= allocation.quantity
                and recipient.unmet_demand >= allocation.quantity
            ):
                updated = self.repository.update_allocation(
                    allocation.allocation_id,
                    recipient_id=recipient.recipient_id,
                    active_candidate_index=next_index,
                    status=AllocationStatus.PLANNED,
                )
                if updated:
                    offer, _ = self._start_allocation(updated)
                    self._event(allocation.donation_id, "system", "OFFER_RELAYED", {
                        "offerId": offer.offer_id,
                        "allocationId": allocation.allocation_id,
                        "recipientId": recipient.recipient_id,
                    })
                    return offer
            next_index += 1
        return None

    def _update_donation_after_transition(self, donation_id: str, next_offer: Offer | None) -> None:
        donation = self.repository.get_donation(donation_id)
        if donation is None:
            return
        if next_offer is not None:
            status = DonationStatus.OFFERING
        elif any(
            item.status == AllocationStatus.ACCEPTED
            for item in self.repository.list_allocations_for_donation(donation_id)
        ):
            status = DonationStatus.ACCEPTED
        elif donation.confirmed_quantity >= donation.quantity:
            status = DonationStatus.RESCUED
        elif donation.confirmed_quantity > 0:
            status = DonationStatus.PARTIALLY_RESCUED
        else:
            status = DonationStatus.OPEN
        self.repository.update_donation(donation_id, status=status)

    def _event(self, donation_id: str, actor_id: str, event_type: str, payload: dict) -> None:
        now = utc_now()
        self.repository.add_event(
            donation_id,
            Event(
                event_id=new_id("evt"),
                actor_id=actor_id,
                event_type=event_type,
                occurred_at=now,
                payload=payload,
            ),
        )

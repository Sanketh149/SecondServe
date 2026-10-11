from datetime import datetime

from app.api import errors
from app.models.allocation import Allocation, AllocationStatus
from app.models.donation import Donation
from app.models.recipient import Recipient
from app.models.rescue_plan import AllocationPlan, PlanStatus, ReadinessStatus, RescuePlan, RoutePlan
from app.models.common import utc_now
from app.repositories.memory import InMemoryRepository
from app.services.route_service import RouteService
from app.utils.ids import new_id


class MatchingService:
    def __init__(self, repository: InMemoryRepository, route_service: RouteService) -> None:
        self.repository = repository
        self.route_service = route_service

    def build_plan(self, donation: Donation, user_organization_id: str) -> RescuePlan:
        if donation.donor_organization_id != user_organization_id:
            raise errors.SecondServeError(403, "FORBIDDEN", "The donation is not owned by this donor.")
        candidates = self.repository.list_recipients()
        now = utc_now()
        if donation.usable_until <= now:
            return self._empty_plan(donation, ["DONATION_CUTOFF_EXPIRED"])

        evaluated: list[tuple[AllocationPlan, Recipient]] = []
        blocked: list[dict] = []
        for recipient in candidates:
            readiness, reasons = self._evaluate_recipient(recipient, donation, now)
            if readiness == ReadinessStatus.READY:
                estimated = self.route_service.estimate(donation.donor_organization_id, recipient.recipient_id)
                if estimated is None:
                    readiness = ReadinessStatus.UNKNOWN
                    reasons = ["ROUTE_UNAVAILABLE"]
                else:
                    estimated_arrival = estimated["arrival_at"]
                    if estimated_arrival >= donation.usable_until:
                        readiness = ReadinessStatus.BLOCKED
                        reasons = ["ARRIVES_AT_OR_AFTER_CUTOFF"]
                    evaluated.append((
                        AllocationPlan(
                            allocation_id=new_id("al"), recipient_id=recipient.recipient_id,
                            recipient_name=recipient.organization_name, quantity=min(donation.quantity, recipient.unmet_demand),
                            readiness=readiness, estimated_arrival_at=estimated_arrival,
                            need_fit=self._need_fit(recipient, donation.quantity), reason_codes=reasons,
                            fallback_candidates=[],
                        ), recipient))
            else:
                blocked.append({"recipientId": recipient.recipient_id, "recipientName": recipient.organization_name, "readiness": readiness.value, "reasonCodes": reasons})

        evaluated.sort(key=lambda item: (-item[0].quantity, -item[0].need_fit, item[0].estimated_arrival_at or datetime.max.replace(tzinfo=None)))
        allocations: list[AllocationPlan] = []
        remaining = donation.quantity
        for plan, recipient in evaluated:
            quantity = min(remaining, recipient.unmet_demand, plan.quantity)
            if quantity <= 0:
                continue
            plan.quantity = quantity
            allocations.append(plan)
            remaining -= quantity

        if not allocations:
            status = PlanStatus.NONE
        elif remaining == 0:
            status = PlanStatus.FULL
        else:
            status = PlanStatus.PARTIAL
        route = None
        if len(allocations) > 1:
            route = self.route_service.build_route([allocation.recipient_id for allocation in allocations])
        return RescuePlan(
            plan_id=new_id("rp"), donation_id=donation.donation_id, status=status,
            donation_quantity=donation.quantity, allocated_quantity=donation.quantity - remaining,
            unallocated_quantity=remaining, allocations=allocations, route=route,
            not_ready_candidates=blocked, created_at=now, updated_at=now,
        )

    def _evaluate_recipient(self, recipient: Recipient, donation: Donation, now: datetime) -> tuple[ReadinessStatus, list[str]]:
        reasons: list[str] = []
        if not recipient.active:
            reasons.append("RECIPIENT_INACTIVE")
        if donation.category not in recipient.accepted_categories:
            reasons.append("CATEGORY_NOT_ACCEPTED")
        if any(tag in recipient.allergen_restrictions for tag in donation.declared_allergens):
            reasons.append("ALLERGEN_RESTRICTED")
        if recipient.unmet_demand <= 0 or recipient.capacity <= 0:
            reasons.append("NO_AVAILABLE_CAPACITY")
        if not self._is_open(recipient, now):
            reasons.append("CLOSED_AT_ARRIVAL")
        if not self._route_is_before_cutoff(recipient, donation, now):
            reasons.append("ARRIVES_AT_OR_AFTER_CUTOFF")
        return (ReadinessStatus.READY if not reasons else ReadinessStatus.BLOCKED, reasons)

    def _is_open(self, recipient: Recipient, now: datetime) -> bool:
        day = now.strftime("%A").lower()
        hours = recipient.hours.get(day, [])
        return any(self._time_between(now.time(), start, end) for start, end in hours)

    def _time_between(self, current, start, end) -> bool:
        start_time = datetime.strptime(start, "%H:%M").time()
        end_time = datetime.strptime(end, "%H:%M").time()
        if start_time <= end_time:
            return start_time <= current <= end_time
        return current >= start_time or current <= end_time

    def _route_is_before_cutoff(self, recipient: Recipient, donation: Donation, now: datetime) -> bool:
        route = self.route_service.estimate(donation.donor_organization_id, recipient.recipient_id)
        return route is not None and route["arrival_at"] < donation.usable_until

    def _need_fit(self, recipient: Recipient, quantity: int) -> float:
        return min(1.0, recipient.unmet_demand / max(quantity, 1))

    def _empty_plan(self, donation: Donation, reasons: list[str]) -> RescuePlan:
        now = utc_now()
        return RescuePlan(plan_id=new_id("rp"), donation_id=donation.donation_id, status=PlanStatus.UNKNOWN,
            donation_quantity=donation.quantity, allocated_quantity=0, unallocated_quantity=donation.quantity,
            allocations=[], route=None, not_ready_candidates=[{"recipientId": "", "recipientName": "", "readiness": ReadinessStatus.UNKNOWN.value, "reasonCodes": reasons}],
            created_at=now, updated_at=now)

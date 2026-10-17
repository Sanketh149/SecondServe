from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.api import errors
from app.models.common import AllergenStatus, utc_now
from app.models.donation import Donation
from app.models.recipient import Recipient
from app.models.rescue_plan import (
    AllocationPlan,
    PlanStatus,
    ReadinessStatus,
    RescuePlan,
    RoutePlan,
)
from app.repositories.memory import InMemoryRepository
from app.services.route_service import RouteService
from app.utils.ids import new_id


class MatchingService:
    def __init__(self, repository: InMemoryRepository, route_service: RouteService) -> None:
        self.repository = repository
        self.route_service = route_service

    def build_plan(self, donation: Donation, user_organization_id: str) -> RescuePlan:
        if donation.donor_organization_id != user_organization_id:
            raise errors.SecondServeError(
                403,
                "FORBIDDEN",
                "The donation is not owned by this donor.",
            )
        now = utc_now()
        if donation.usable_until <= now:
            return self._empty_plan(donation, ["DONATION_CUTOFF_EXPIRED"])

        ready: list[tuple[AllocationPlan, Recipient]] = []
        blocked: list[dict] = []
        unknown_candidate = False
        completion_history = self._completion_history_by_recipient()
        for recipient in self.repository.list_recipients():
            reasons = self._recipient_reasons(recipient, donation)
            if reasons:
                blocked.append(self._candidate(recipient, ReadinessStatus.BLOCKED, reasons))
                continue

            estimate = self.route_service.estimate(
                donation.donor_organization_id,
                recipient.recipient_id,
                donation.pickup_available_at,
            )
            if estimate is None:
                unknown_candidate = True
                blocked.append(
                    self._candidate(
                        recipient,
                        ReadinessStatus.UNKNOWN,
                        ["ROUTE_UNAVAILABLE"],
                    )
                )
                continue

            arrival = estimate["arrival_at"]
            if arrival >= donation.usable_until:
                blocked.append(
                    self._candidate(
                        recipient,
                        ReadinessStatus.BLOCKED,
                        ["ARRIVES_AT_OR_AFTER_CUTOFF"],
                    )
                )
                continue
            if not self._is_open_at(recipient, arrival):
                blocked.append(
                    self._candidate(
                        recipient,
                        ReadinessStatus.BLOCKED,
                        ["CLOSED_AT_ARRIVAL"],
                    )
                )
                continue

            available = min(recipient.capacity, recipient.unmet_demand)
            completion_rate, history_count = completion_history.get(
                recipient.recipient_id,
                (None, 0),
            )
            reason_codes = [
                "HIGH_UNMET_NEED",
                "CAPACITY_FITS",
                "OPEN_AT_ARRIVAL",
                "ARRIVES_BEFORE_CUTOFF",
            ]
            if history_count >= 3 and completion_rate is not None:
                reason_codes.append("RECIPIENT_HISTORY_AVAILABLE")
            ready.append(
                (
                    AllocationPlan(
                        allocation_id=new_id("al"),
                        recipient_id=recipient.recipient_id,
                        recipient_name=recipient.organization_name,
                        quantity=min(donation.quantity, available),
                        readiness=ReadinessStatus.READY,
                        estimated_arrival_at=arrival,
                        need_fit=min(1.0, recipient.unmet_demand / donation.quantity),
                        recipient_completion_rate=completion_rate,
                        completion_history_sample_size=history_count,
                        reason_codes=reason_codes,
                        fallback_candidates=[],
                    ),
                    recipient,
                )
            )

        ready.sort(
            key=lambda item: (
                -item[0].quantity,
                -item[0].need_fit,
                -(
                    item[0].recipient_completion_rate
                    if item[0].completion_history_sample_size >= 3
                    and item[0].recipient_completion_rate is not None
                    else 0.0
                ),
                item[0].estimated_arrival_at or datetime.max.replace(tzinfo=timezone.utc),
            )
        )
        allocations: list[AllocationPlan] = []
        remaining = donation.quantity
        for plan, recipient in ready:
            quantity = min(remaining, recipient.capacity, recipient.unmet_demand)
            if quantity <= 0:
                continue
            plan.quantity = quantity
            allocations.append(plan)
            remaining -= quantity
            if len(allocations) == 2 or remaining == 0:
                break

        selected_ids = {item.recipient_id for item in allocations}
        fallback_recipients = [
            item
            for plan, item in ready
            if item.recipient_id not in selected_ids
        ]
        if allocations and fallback_recipients:
            allocations[0].fallback_candidates = [
                {
                    "recipientId": item.recipient_id,
                    "recipientName": item.organization_name,
                    "readiness": ReadinessStatus.READY,
                }
                for item in fallback_recipients
            ]

        if not allocations:
            status = PlanStatus.UNKNOWN if unknown_candidate else PlanStatus.NONE
        elif unknown_candidate:
            status = PlanStatus.UNKNOWN
        elif remaining == 0:
            status = PlanStatus.FULL
        else:
            status = PlanStatus.PARTIAL

        route_data = self.route_service.build_route(
            donation.donor_organization_id,
            [item.recipient_id for item in allocations],
            donation.pickup_available_at,
        ) if allocations else None
        route = RoutePlan(**route_data) if route_data else None
        if len(allocations) > 1 and route is None:
            status = PlanStatus.UNKNOWN

        return RescuePlan(
            plan_id=new_id("rp"),
            donation_id=donation.donation_id,
            status=status,
            donation_quantity=donation.quantity,
            allocated_quantity=donation.quantity - remaining,
            unallocated_quantity=remaining,
            allocations=allocations,
            route=route,
            not_ready_candidates=blocked,
            created_at=now,
            updated_at=now,
        )

    def _recipient_reasons(self, recipient: Recipient, donation: Donation) -> list[str]:
        reasons: list[str] = []
        if not recipient.active:
            reasons.append("RECIPIENT_INACTIVE")
        accepts_all_categories = any(
            category.casefold() in {"any", "any_food", "*"}
            for category in recipient.accepted_categories
        )
        if not accepts_all_categories and donation.category not in recipient.accepted_categories:
            reasons.append("CATEGORY_NOT_ACCEPTED")
        if recipient.unmet_demand <= 0 or recipient.capacity <= 0:
            reasons.append("NO_AVAILABLE_CAPACITY")
        if donation.allergen_status == AllergenStatus.UNKNOWN and recipient.allergen_restrictions:
            reasons.append("ALLERGEN_INFORMATION_UNKNOWN")
        elif any(
            allergen.casefold() in {
                restriction.casefold() for restriction in recipient.allergen_restrictions
            }
            for allergen in donation.declared_allergens
        ):
            reasons.append("ALLERGEN_RESTRICTED")
        return reasons

    def _completion_history_by_recipient(
        self,
    ) -> dict[str, tuple[float | None, int]]:
        totals: dict[str, list[int]] = {}
        for allocation in self.repository.list_all_allocations():
            if allocation.status.value != "DELIVERED":
                continue
            value = totals.setdefault(allocation.recipient_id, [0, 0, 0])
            value[0] += allocation.quantity
            value[1] += allocation.confirmed_quantity
            value[2] += 1
        return {
            recipient_id: (
                confirmed / allocated if allocated > 0 else None,
                sample_size,
            )
            for recipient_id, (allocated, confirmed, sample_size) in totals.items()
        }

    def _is_open_at(self, recipient: Recipient, arrival: datetime) -> bool:
        try:
            local_arrival = arrival.astimezone(ZoneInfo(recipient.timezone))
        except ZoneInfoNotFoundError:
            return False
        day = local_arrival.strftime("%A").lower()
        for start, end in recipient.hours.get(day, []):
            start_time = datetime.strptime(start, "%H:%M").time()
            end_time = datetime.strptime(end, "%H:%M").time()
            if start_time == end_time == time.min:
                return True
            if start_time <= end_time:
                if start_time <= local_arrival.time() <= end_time:
                    return True
            elif local_arrival.time() >= start_time or local_arrival.time() <= end_time:
                return True
        return False

    @staticmethod
    def _candidate(
        recipient: Recipient,
        readiness: ReadinessStatus,
        reasons: list[str],
    ) -> dict:
        return {
            "recipientId": recipient.recipient_id,
            "recipientName": recipient.organization_name,
            "readiness": readiness,
            "reasonCodes": reasons,
        }

    def _empty_plan(self, donation: Donation, reasons: list[str]) -> RescuePlan:
        now = utc_now()
        return RescuePlan(
            plan_id=new_id("rp"),
            donation_id=donation.donation_id,
            status=PlanStatus.UNKNOWN,
            donation_quantity=donation.quantity,
            allocated_quantity=0,
            unallocated_quantity=donation.quantity,
            allocations=[],
            route=None,
            not_ready_candidates=[
                {
                    "recipientId": "",
                    "recipientName": "",
                    "readiness": ReadinessStatus.UNKNOWN,
                    "reasonCodes": reasons,
                }
            ],
            created_at=now,
            updated_at=now,
        )

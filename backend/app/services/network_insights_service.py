from __future__ import annotations

from collections import defaultdict
from app.models.common import Role, utc_now
from app.models.donation import DonationStatus
from app.models.user import CurrentUser
from app.repositories.memory import InMemoryRepository

GRID_DEGREES = 0.05
GRID_SIZE_KM = 5
ACTIVE_DONATION_STATUSES = {
    DonationStatus.OPEN,
    DonationStatus.PLANNED,
    DonationStatus.OFFERING,
}


class NetworkInsightsService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository

    def for_user(self, user: CurrentUser) -> dict:
        return {
            "heatmap_cells": self._heatmap_cells(),
            "heatmap_cell_size_km": GRID_SIZE_KM,
            "partnerships": self._partnerships(user),
            "network_organization_count": len(self.repository.list_all_organizations()),
        }

    def _heatmap_cells(self) -> list[dict]:
        organizations = self.repository.list_all_organizations()
        organization_by_id = {
            organization.organization_id: organization for organization in organizations
        }
        cells: dict[tuple[int, int], dict] = {}

        def add_to_cell(latitude: float, longitude: float) -> dict:
            key = (
                int(latitude // GRID_DEGREES),
                int(longitude // GRID_DEGREES),
            )
            if key not in cells:
                center_latitude = (key[0] + 0.5) * GRID_DEGREES
                center_longitude = (key[1] + 0.5) * GRID_DEGREES
                cells[key] = {
                    "latitude": round(center_latitude, 3),
                    "longitude": round(center_longitude, 3),
                    "active_surplus_meals": 0,
                    "unmet_need_meals": 0,
                    "donor_organizations": 0,
                    "recipient_organizations": 0,
                    "_donor_ids": set(),
                    "_recipient_ids": set(),
                }
            return cells[key]

        now = utc_now()
        for donation in self.repository.list_all_donations():
            if (
                donation.status not in ACTIVE_DONATION_STATUSES
                or donation.usable_until <= now
            ):
                continue
            donor = organization_by_id.get(donation.donor_organization_id)
            remaining = max(0, donation.quantity - donation.confirmed_quantity)
            if donor is None or remaining == 0:
                continue
            cell = add_to_cell(donor.location.latitude, donor.location.longitude)
            cell["active_surplus_meals"] += remaining
            cell["_donor_ids"].add(donor.organization_id)

        for recipient in self.repository.list_recipients():
            if not recipient.active or recipient.unmet_demand <= 0:
                continue
            cell = add_to_cell(
                recipient.location.latitude,
                recipient.location.longitude,
            )
            cell["unmet_need_meals"] += recipient.unmet_demand
            cell["_recipient_ids"].add(recipient.organization_id)

        result = []
        for cell in cells.values():
            cell["donor_organizations"] = len(cell.pop("_donor_ids"))
            cell["recipient_organizations"] = len(cell.pop("_recipient_ids"))
            result.append(cell)
        return sorted(result, key=lambda cell: (cell["latitude"], cell["longitude"]))

    def _partnerships(self, user: CurrentUser) -> list[dict]:
        if not user.organization_id:
            return []
        totals: dict[str, dict] = defaultdict(
            lambda: {"completed_rescues": 0, "confirmed_meals": 0, "last_confirmed_at": None}
        )
        donor_side = user.role == Role.DONOR
        for receipt in self.repository.list_all_receipts():
            donation = self.repository.get_donation(receipt.donation_id)
            if donation is None:
                continue
            if donor_side:
                if donation.donor_organization_id != user.organization_id:
                    continue
                partner_id = receipt.recipient_organization_id
            else:
                if receipt.recipient_organization_id != user.organization_id:
                    continue
                partner_id = donation.donor_organization_id
            total = totals[partner_id]
            total["completed_rescues"] += 1
            total["confirmed_meals"] += receipt.quantity_received
            previous = total["last_confirmed_at"]
            if previous is None or receipt.confirmed_at > previous:
                total["last_confirmed_at"] = receipt.confirmed_at

        recommendations = []
        for organization_id, total in totals.items():
            organization = self.repository.get_organization(organization_id)
            if organization is None:
                continue
            count = total["completed_rescues"]
            meals = total["confirmed_meals"]
            recommendations.append(
                {
                    "organization_name": organization.name,
                    "completed_rescues": count,
                    "confirmed_meals": meals,
                    "last_confirmed_at": total["last_confirmed_at"],
                    "reason": (
                        f"{count} recipient-confirmed rescue"
                        f"{'' if count == 1 else 's'} delivered {meals} meals together."
                    ),
                }
            )
        recommendations.sort(
            key=lambda item: (
                -item["completed_rescues"],
                -item["confirmed_meals"],
                -item["last_confirmed_at"].timestamp(),
            )
        )
        return recommendations[:5]

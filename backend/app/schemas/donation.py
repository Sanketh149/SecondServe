from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.allocation import Allocation
from app.models.donation import Donation, DonationStatus
from app.models.events import Event
from app.models.offer import Offer
from app.models.rescue_plan import RescuePlan


class DonationResponse(Donation):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class DonationListResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
    donations: list[DonationResponse]


class DonationAllocationResponse(Allocation):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
    recipient_name: str
    distance: str = "Route estimate unavailable"
    eta: str = "Route estimate unavailable"
    received_quantity: int = 0


class DonationDetailResponse(DonationResponse):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
    plan: RescuePlan | None = None
    allocations: list[DonationAllocationResponse] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    current_offer: Offer | None = None
    handoff_code: str | None = None


class DonationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: DonationStatus

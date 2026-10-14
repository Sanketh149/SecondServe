from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.offer import Offer


class OfferResponse(Offer):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class OfferListResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
    offers: list[OfferResponse]


class OfferDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    decision: str
    reason: str | None = None


class PickupStatusRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    status: Literal["EN_ROUTE", "ARRIVED"]


class PickupStatusResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    offer_id: str
    allocation_id: str
    status: Literal["EN_ROUTE", "ARRIVED"]
    updated_at: datetime

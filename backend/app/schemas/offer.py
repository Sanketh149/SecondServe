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

from pydantic import BaseModel, ConfigDict

from app.models.offer import Offer


class OfferResponse(Offer):
    model_config = ConfigDict(extra="forbid")


class OfferListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    offers: list[OfferResponse]

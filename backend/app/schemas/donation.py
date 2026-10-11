from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.donation import Donation, DonationStatus


class DonationResponse(Donation):
    model_config = ConfigDict(extra="forbid")


class DonationListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    donations: list[DonationResponse]


class DonationUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: DonationStatus

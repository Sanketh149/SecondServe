from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.donation import CreateDonationRequest
from app.models.rescue_plan import RescuePlan


class RescuePlanResponse(RescuePlan):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class RescuePlanStartResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    plan_id: str
    offer_id: str | None
    status: str
    handoff_code: str | None = None


class RescuePlanPreviewRequest(CreateDonationRequest):
    pass

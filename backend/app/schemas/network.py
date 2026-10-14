from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class RescueHeatmapCell(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    latitude: float
    longitude: float
    active_surplus_meals: int
    unmet_need_meals: int
    donor_organizations: int
    recipient_organizations: int


class PartnershipRecommendation(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    organization_name: str
    completed_rescues: int
    confirmed_meals: int
    last_confirmed_at: datetime
    reason: str


class NetworkInsightsResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    heatmap_cells: list[RescueHeatmapCell]
    heatmap_cell_size_km: int
    partnerships: list[PartnershipRecommendation]
    network_organization_count: int

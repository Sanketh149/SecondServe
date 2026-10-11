from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ImpactSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    confirmed_quantity: int
    rescued_meals: int
    receipts_count: int
    period: str


class ForecastResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    sample_size: int
    source: str
    insufficient_history: bool
    opportunities: list[dict]

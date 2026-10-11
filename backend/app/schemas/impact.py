from pydantic import BaseModel, ConfigDict


class ImpactSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed_quantity: int
    rescued_meals: int
    receipts_count: int
    period: str


class ForecastResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sample_size: int
    source: str
    insufficient_history: bool
    opportunities: list[dict]

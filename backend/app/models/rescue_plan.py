from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import TimestampModel


class PlanStatus(str, Enum):
    FULL = "FULL"
    PARTIAL = "PARTIAL"
    NONE = "NONE"
    UNKNOWN = "UNKNOWN"


class ReadinessStatus(str, Enum):
    READY = "READY"
    BLOCKED = "BLOCKED"
    UNKNOWN = "UNKNOWN"


class AllocationPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    allocation_id: str
    recipient_id: str
    recipient_name: str
    quantity: int = Field(gt=0)
    readiness: ReadinessStatus
    estimated_arrival_at: datetime | None
    need_fit: float = Field(ge=0.0, le=1.0)
    reason_codes: list[str]
    fallback_candidates: list[dict[str, str | ReadinessStatus]] = Field(default_factory=list)


class RoutePlan(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    ordered_recipient_ids: list[str]
    distance_meters: int | None
    duration_seconds: int | None
    provider: str


class RescuePlan(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    plan_id: str
    donation_id: str
    status: PlanStatus
    donation_quantity: int
    allocated_quantity: int
    unallocated_quantity: int
    allocations: list[AllocationPlan]
    route: RoutePlan | None
    not_ready_candidates: list[dict[str, str | ReadinessStatus | list[str]]]

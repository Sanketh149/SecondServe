from enum import Enum

from pydantic import ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import TimestampModel


class AllocationStatus(str, Enum):
    PLANNED = "PLANNED"
    OFFERING = "OFFERING"
    ACCEPTED = "ACCEPTED"
    DELIVERED = "DELIVERED"
    UNASSIGNED = "UNASSIGNED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class Allocation(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    allocation_id: str
    plan_id: str
    donation_id: str
    recipient_id: str
    quantity: int = Field(gt=0)
    status: AllocationStatus
    confirmed_quantity: int = 0
    active_candidate_index: int = 0
    assigned_candidate_ids: list[str] = Field(default_factory=list)
    handoff_code_hash: str | None = Field(default=None, exclude=True)

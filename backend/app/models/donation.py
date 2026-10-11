from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import TimestampModel


class DonationStatus(str, Enum):
    OPEN = "OPEN"
    PLANNED = "PLANNED"
    OFFERING = "OFFERING"
    PARTIALLY_ACCEPTED = "PARTIALLY_ACCEPTED"
    ACCEPTED = "ACCEPTED"
    IN_PROGRESS = "IN_PROGRESS"
    RESCUED = "RESCUED"
    PARTIALLY_RESCUED = "PARTIALLY_RESCUED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class Donation(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    donation_id: str
    donor_organization_id: str
    item_name: str
    category: str
    quantity: int = Field(gt=0)
    unit: str
    dietary_tags: list[str]
    declared_allergens: list[str]
    allergen_status: str
    prepared_at: datetime
    storage_condition: str
    pickup_available_at: datetime
    usable_until: datetime
    analysis_id: str | None
    status: DonationStatus
    plan_id: str | None
    confirmed_quantity: int = 0
    handoff_code_hash: str | None = Field(default=None, exclude=True)


class CreateDonationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    analysis_id: str | None = None
    item_name: str
    category: str
    quantity: int = Field(gt=0)
    unit: str
    dietary_tags: list[str] = Field(default_factory=list)
    declared_allergens: list[str] = Field(default_factory=list)
    allergen_status: str
    prepared_at: datetime
    storage_condition: str
    pickup_available_at: datetime
    usable_until: datetime

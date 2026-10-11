from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.models.common import AllergenStatus, TimestampModel
from app.utils.time import as_utc


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
    allergen_status: AllergenStatus
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
    allergen_status: AllergenStatus
    prepared_at: datetime
    storage_condition: str
    pickup_available_at: datetime
    usable_until: datetime
    donor_confirmed: bool = False

    @model_validator(mode="after")
    def validate_cutoff(self) -> "CreateDonationRequest":
        prepared_at = as_utc(self.prepared_at)
        pickup_available_at = as_utc(self.pickup_available_at)
        usable_until = as_utc(self.usable_until)
        if prepared_at > pickup_available_at:
            raise ValueError("Preparation time must be at or before pickup availability.")
        if pickup_available_at > usable_until:
            raise ValueError("Pickup availability must be at or before the usable-until cutoff.")
        return self

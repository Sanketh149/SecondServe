from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import TimestampModel
from app.models.organization import Location


class Recipient(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    recipient_id: str
    organization_id: str
    organization_name: str
    active: bool
    location: Location
    timezone: str
    hours: dict[str, list[tuple[str, str]]]
    capacity: int = Field(ge=0)
    unmet_demand: int = Field(ge=0)
    accepted_categories: list[str]
    dietary_tags: list[str]
    allergen_restrictions: list[str]
    confirmed_deliveries: list[str]


class RecipientAvailability(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    recipient_id: str
    available: bool
    reason_codes: list[str]

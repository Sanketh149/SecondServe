from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, Enum):
    DONOR = "donor"
    RECIPIENT = "recipient"
    ADMIN = "admin"


class Source(str, Enum):
    AI_SUGGESTED = "AI_SUGGESTED"
    DONOR_CONFIRMED = "DONOR_CONFIRMED"
    UNKNOWN = "UNKNOWN"


class AllergenStatus(str, Enum):
    DONOR_CONFIRMED = "DONOR_CONFIRMED"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class TimestampModel(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    created_at: datetime
    updated_at: datetime


class FieldValue(BaseModel):
    value: Any
    source: Source
    confidence: float = Field(ge=0.0, le=1.0)


class SafeError(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)

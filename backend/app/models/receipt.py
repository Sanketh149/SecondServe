from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import TimestampModel


class Receipt(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    receipt_id: str
    allocation_id: str
    donation_id: str
    recipient_organization_id: str
    quantity_received: int = Field(gt=0)
    confirmed_at: datetime
    handoff_code_hash: str = Field(exclude=True)
    exception_reason: str | None


class ReceiptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    handoff_code: str = Field(min_length=6, max_length=20)
    quantity_received: int = Field(gt=0)
    exception_reason: str | None = None

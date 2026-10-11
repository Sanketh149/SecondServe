from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.receipt import Receipt


class ReceiptResponse(Receipt):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class ReceiptListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    receipts: list[ReceiptResponse]

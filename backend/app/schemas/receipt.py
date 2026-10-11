from pydantic import BaseModel, ConfigDict

from app.models.receipt import Receipt


class ReceiptResponse(Receipt):
    model_config = ConfigDict(extra="forbid")


class ReceiptListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    receipts: list[ReceiptResponse]

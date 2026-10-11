from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import FieldValue, Source, TimestampModel


class FoodAnalysis(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    analysis_id: str
    owner_uid: str
    image_path: str | None
    expires_at: datetime
    candidate: dict[str, FieldValue]
    required_confirmations: list[str]
    safety_notice: str
    confirmed: bool = False


class FoodAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    image: bytes
    filename: str
    content_type: str

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.models.common import FieldValue


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    analysis_id: str
    expires_at: datetime
    candidate: dict[str, FieldValue]
    required_confirmations: list[str]
    safety_notice: str


class AnalysisErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: str
    message: str

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class GuidanceRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    question: str = Field(min_length=3, max_length=500)
    donation_id: str | None = None


class GuidanceResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    answer: str
    based_on: list[str]
    limitations: str

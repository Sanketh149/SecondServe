from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

from app.models.recipient import Recipient


class RecipientProfileResponse(Recipient):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

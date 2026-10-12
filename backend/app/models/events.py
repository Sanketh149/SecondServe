from datetime import datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Event(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    event_id: str
    donation_id: str | None = None
    actor_id: str
    event_type: str
    occurred_at: datetime
    payload: dict

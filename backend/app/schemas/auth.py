from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class MeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    uid: str
    role: str
    organization_id: str
    display_name: str

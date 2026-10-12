from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.common import Role, TimestampModel


class UserProfile(TimestampModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)
    uid: str
    display_name: str
    role: Role
    organization_id: str


class CurrentUser(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    uid: str
    role: Role | None = None
    organization_id: str | None = None
    display_name: str | None = None

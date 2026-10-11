from pydantic import BaseModel, ConfigDict


class MeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: str
    role: str
    organization_id: str
    display_name: str

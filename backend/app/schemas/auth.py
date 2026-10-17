from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.models.organization import Location


class MeResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )
    uid: str
    role: Literal["donor", "recipient"] | None = None
    organization_id: str | None = None
    display_name: str | None = None
    organization_name: str | None = None
    organization_address: str | None = None
    recipient_id: str | None = None


class CreateProfileRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    role: Literal["donor", "recipient"]
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    organization_name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: str = Field(min_length=3, max_length=64)
    capacity: int | None = Field(default=None, ge=1, le=100_000)
    unmet_demand: int | None = Field(default=None, ge=0, le=100_000)
    accepted_categories: list[str] = Field(default_factory=list)
    dietary_tags: list[str] = Field(default_factory=list)
    allergen_restrictions: list[str] = Field(default_factory=list)
    open_time: str = "09:00"
    close_time: str = "17:00"
    open_saturday: bool = False
    open_sunday: bool = False

    @field_validator("timezone", mode="before")
    @classmethod
    def normalize_timezone_alias(cls, value: str) -> str:
        return {
            "Asia/Calcutta": "Asia/Kolkata",
        }.get(value, value)

    @model_validator(mode="after")
    def validate_recipient_fields(self) -> "CreateProfileRequest":
        if self.role == "recipient":
            if self.capacity is None or self.unmet_demand is None:
                raise ValueError("Recipient capacity and unmet demand are required.")
            if self.unmet_demand > self.capacity:
                raise ValueError("Unmet demand cannot exceed meal capacity.")
            if not self.accepted_categories:
                raise ValueError("Select at least one accepted food category.")
        return self

    @property
    def location(self) -> Location:
        return Location(latitude=self.latitude, longitude=self.longitude)

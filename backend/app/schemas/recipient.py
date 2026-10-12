from datetime import time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.models.recipient import Recipient


class UpdateRecipientProfileRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    timezone: str = Field(min_length=3, max_length=64)
    hours: dict[str, list[tuple[str, str]]]
    capacity: int = Field(ge=1, le=100_000)
    unmet_demand: int = Field(ge=0, le=100_000)
    accepted_categories: list[str] = Field(min_length=1)
    dietary_tags: list[str] = Field(default_factory=list)
    allergen_restrictions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_profile(self) -> "UpdateRecipientProfileRequest":
        if self.unmet_demand > self.capacity:
            raise ValueError("Unmet demand cannot exceed meal capacity.")
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Enter a valid time zone.") from exc

        valid_days = {
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        }
        if not set(self.hours).issubset(valid_days):
            raise ValueError("Hours must use valid weekday names.")
        for ranges in self.hours.values():
            if any(
                opening == "00:00" and closing == "00:00"
                for opening, closing in ranges
            ) and len(ranges) > 1:
                raise ValueError(
                    "An all-day opening period cannot be combined with other periods."
                )
            parsed_ranges: list[tuple[time, time]] = []
            for opening, closing in ranges:
                try:
                    start = time.fromisoformat(opening)
                    end = time.fromisoformat(closing)
                except ValueError as exc:
                    raise ValueError("Enter valid opening and closing times.") from exc
                if start > end or (start == end and start != time.min):
                    raise ValueError("Closing time must be later than opening time.")
                parsed_ranges.append((start, end))
            ordered_ranges = sorted(parsed_ranges)
            if any(
                ordered_ranges[index][0] < ordered_ranges[index - 1][1]
                for index in range(1, len(ordered_ranges))
            ):
                raise ValueError("Opening periods on the same day cannot overlap.")
        return self


class RecipientProfileResponse(Recipient):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

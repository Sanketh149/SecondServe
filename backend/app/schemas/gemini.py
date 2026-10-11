from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

FoodCategory = Literal[
    "prepared_meal",
    "bakery",
    "produce",
    "packaged_food",
    "other",
]

VisiblePackaging = Literal[
    "not_visible",
    "clear_plastic_container",
    "vacuum_sealed_bag",
    "aluminum_can",
    "glass_jar",
    "paper_bag",
    "cardboard_box",
    "plastic_wrap",
    "original_packaging",
    "mixed_packaging",
    "other",
]

DietaryTag = Literal["vegetarian", "vegan", "halal", "gluten-free"]

PotentialAllergen = Literal[
    "milk",
    "eggs",
    "fish",
    "shellfish",
    "tree nuts",
    "peanuts",
    "wheat",
    "soy",
    "sesame",
]


class FoodPassportConfidence(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    name: float = Field(ge=0, le=1)
    category: float = Field(ge=0, le=1)
    visible_packaging: float = Field(ge=0, le=1)
    dietary_tags: float = Field(ge=0, le=1)
    potential_allergens: float = Field(ge=0, le=1)
    quantity_suggestion: float = Field(ge=0, le=1)


class GeminiFoodPassportOutput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )

    name: StrictStr = Field(min_length=3, max_length=120)
    category: FoodCategory
    visible_packaging: VisiblePackaging
    dietary_tags: list[DietaryTag] = Field(max_length=4)
    potential_allergens: list[PotentialAllergen] = Field(max_length=9)
    quantity_suggestion: StrictInt | None = Field(default=None, gt=0)
    confidence: FoodPassportConfidence

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if cleaned.casefold() in {
            "unknown",
            "n/a",
            "none",
            "not sure",
            "food",
            "food item",
        }:
            raise ValueError("Name must be a useful visual description, not an unknown placeholder.")
        return cleaned

    @field_validator("dietary_tags", "potential_allergens")
    @classmethod
    def validate_unique_values(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("Suggestions must not contain duplicate values.")
        return values

    @model_validator(mode="after")
    def validate_empty_suggestion_confidence(self) -> "GeminiFoodPassportOutput":
        if self.confidence.name <= 0 or self.confidence.category <= 0:
            raise ValueError("Name and category must have positive confidence when supplied.")
        if not self.dietary_tags and self.confidence.dietary_tags != 0:
            raise ValueError("Empty dietary suggestions must have zero confidence.")
        if not self.potential_allergens and self.confidence.potential_allergens != 0:
            raise ValueError("Empty allergen suggestions must have zero confidence.")
        if self.quantity_suggestion is None and self.confidence.quantity_suggestion != 0:
            raise ValueError("An absent quantity suggestion must have zero confidence.")
        if self.quantity_suggestion is not None and self.confidence.quantity_suggestion <= 0:
            raise ValueError("A quantity suggestion must have positive confidence.")
        return self

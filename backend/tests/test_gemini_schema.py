import pytest
from pydantic import ValidationError

from app.schemas.gemini import GeminiFoodPassportOutput


def valid_suggestion() -> dict:
    return {
        "name": "Mixed assortment of refrigerated food items",
        "category": "other",
        "visiblePackaging": "mixed_packaging",
        "dietaryTags": [],
        "potentialAllergens": [],
        "quantitySuggestion": None,
        "confidence": {
            "name": 0.92,
            "category": 0.91,
            "visiblePackaging": 0.8,
            "dietaryTags": 0,
            "potentialAllergens": 0,
            "quantitySuggestion": 0,
        },
    }


def test_gemini_output_accepts_enumerated_visual_suggestion() -> None:
    result = GeminiFoodPassportOutput.model_validate(valid_suggestion())
    assert result.name == "Mixed assortment of refrigerated food items"
    assert result.category == "other"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", "unknown"),
        ("category", "prepared food maybe"),
        ("visiblePackaging", "unknown"),
        ("dietaryTags", ["probably vegan"]),
        ("potentialAllergens", ["maybe nuts"]),
    ],
)
def test_gemini_output_rejects_unknown_or_unapproved_values(
    field: str,
    value: object,
) -> None:
    suggestion = valid_suggestion()
    suggestion[field] = value
    with pytest.raises(ValidationError):
        GeminiFoodPassportOutput.model_validate(suggestion)


def test_empty_dietary_or_allergen_lists_cannot_claim_confidence() -> None:
    suggestion = valid_suggestion()
    suggestion["confidence"]["dietaryTags"] = 0.6
    with pytest.raises(ValidationError):
        GeminiFoodPassportOutput.model_validate(suggestion)


def test_quantity_ballpark_requires_a_positive_integer_and_confidence() -> None:
    suggestion = valid_suggestion()
    suggestion["quantitySuggestion"] = 6
    suggestion["confidence"]["quantitySuggestion"] = 0.35
    result = GeminiFoodPassportOutput.model_validate(suggestion)
    assert result.quantity_suggestion == 6

    suggestion["quantitySuggestion"] = 0
    with pytest.raises(ValidationError):
        GeminiFoodPassportOutput.model_validate(suggestion)

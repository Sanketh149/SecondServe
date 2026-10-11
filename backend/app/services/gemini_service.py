from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any

from pydantic import ValidationError

from app.api import errors
from app.config import get_settings
from app.models.analysis import FoodAnalysis
from app.models.common import FieldValue, Source, utc_now
from app.repositories.memory import InMemoryRepository
from app.schemas.gemini import GeminiFoodPassportOutput
from app.utils.ids import new_id

logger = logging.getLogger(__name__)
SAFETY_NOTICE = (
    "Visual analysis does not determine food safety or confirm ingredients."
)
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING"},
        "category": {
            "type": "STRING",
            "enum": ["prepared_meal", "bakery", "produce", "packaged_food", "other"],
        },
        "visiblePackaging": {
            "type": "STRING",
            "enum": [
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
            ],
        },
        "dietaryTags": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
                "enum": ["vegetarian", "vegan", "halal", "gluten-free"],
            },
        },
        "potentialAllergens": {
            "type": "ARRAY",
            "items": {
                "type": "STRING",
                "enum": [
                    "milk",
                    "eggs",
                    "fish",
                    "shellfish",
                    "tree nuts",
                    "peanuts",
                    "wheat",
                    "soy",
                    "sesame",
                ],
            },
        },
        "quantitySuggestion": {
            "type": "INTEGER",
            "nullable": True,
        },
        "confidence": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "NUMBER"},
                "category": {"type": "NUMBER"},
                "visiblePackaging": {"type": "NUMBER"},
                "dietaryTags": {"type": "NUMBER"},
                "potentialAllergens": {"type": "NUMBER"},
                "quantitySuggestion": {"type": "NUMBER"},
            },
            "required": [
                "name",
                "category",
                "visiblePackaging",
                "dietaryTags",
                "potentialAllergens",
                "quantitySuggestion",
            ],
        },
    },
    "required": [
        "name",
        "category",
        "visiblePackaging",
        "dietaryTags",
        "potentialAllergens",
        "quantitySuggestion",
        "confidence",
    ],
}


class GeminiService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository
        self.settings = get_settings()

    def analyze(
        self,
        owner_uid: str,
        image: bytes,
        filename: str,
        content_type: str,
    ) -> FoodAnalysis:
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        if content_type not in allowed_types:
            raise errors.SecondServeError(
                415,
                "UNSUPPORTED_IMAGE",
                "Choose a JPEG, PNG, or WEBP image.",
            )
        if not image:
            raise errors.SecondServeError(422, "EMPTY_IMAGE", "The image file is empty.")
        if len(image) > self.settings.max_upload_bytes:
            raise errors.SecondServeError(
                413,
                "IMAGE_TOO_LARGE",
                "The image exceeds the configured size limit.",
            )
        signatures = {
            "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
            "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/webp": lambda data: (
                len(data) >= 12
                and data.startswith(b"RIFF")
                and data[8:12] == b"WEBP"
            ),
        }
        if not signatures[content_type](image):
            raise errors.SecondServeError(
                415,
                "IMAGE_CONTENT_MISMATCH",
                "The uploaded file content does not match its declared image type.",
            )

        try:
            candidate_data = self._generate_candidate(image, content_type)
            candidate = self._to_field_values(candidate_data)
        except errors.SecondServeError:
            raise
        except ValidationError as exc:
            logger.exception("Gemini output failed Food Passport schema validation")
            raise errors.SecondServeError(
                502,
                "AI_INVALID_RESPONSE",
                "Image analysis returned unsupported values. Continue with manual entry.",
            ) from exc
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            logger.exception("Gemini returned an invalid Food Passport response")
            raise errors.SecondServeError(
                502,
                "AI_INVALID_RESPONSE",
                "Image analysis returned an invalid response. Continue with manual entry.",
            ) from exc
        except Exception as exc:
            logger.exception("Vertex AI image analysis failed")
            raise errors.SecondServeError(
                502,
                "AI_ANALYSIS_FAILED",
                "Image analysis failed. Continue with manual entry.",
            ) from exc

        now = utc_now()
        analysis = FoodAnalysis(
            analysis_id=new_id("an"),
            owner_uid=owner_uid,
            image_path=None,
            expires_at=now + timedelta(hours=24),
            candidate=candidate,
            required_confirmations=[
                "name",
                "category",
                "quantity",
                "unit",
                "allergenStatus",
                "preparedAt",
                "storageCondition",
                "pickupAvailableAt",
                "usableUntil",
            ],
            safety_notice=SAFETY_NOTICE,
            created_at=now,
            updated_at=now,
        )
        return self.repository.create_analysis(analysis)

    def _generate_candidate(self, image: bytes, content_type: str) -> dict[str, Any]:
        project_id = self.settings.vertex_ai_project_id or self.settings.firestore_project_id
        if not project_id:
            raise errors.SecondServeError(
                503,
                "AI_NOT_CONFIGURED",
                "Image analysis is unavailable because Vertex AI is not configured. Continue with manual entry.",
            )
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            logger.exception("Google Gen AI SDK is not installed")
            raise errors.SecondServeError(
                503,
                "AI_CLIENT_UNAVAILABLE",
                "Image analysis is unavailable. Continue with manual entry.",
            ) from exc

        prompt = (
            "Create a donor-editable visual draft. First decide whether the image "
            "shows one homogeneous food lot or multiple distinct products. If it "
            "shows a refrigerator, shelf, tray, or scene with several food types, "
            "do not select only one visible item. Return a neutral name such as "
            "'Mixed assortment of refrigerated food items' and category 'other'. "
            "Use prepared_meal, bakery, produce, or packaged_food only when one "
            "distinct homogeneous lot is clearly the subject. Always return a "
            "useful, non-empty name and a category from the supplied enum; never "
            "return 'unknown', 'n/a', null, or an invented category. Choose visible "
            "packaging only from the supplied enum, using not_visible if none can "
            "be identified. Only suggest a dietary tag when explicit readable "
            "package text supports it. Only suggest a potential allergen when "
            "specific allergen text is clearly readable on packaging; otherwise "
            "return an empty list and confidence 0, never implying allergen-free. "
            "Give a ballpark quantity suggestion whenever visible evidence provides "
            "a reasonable basis, even if the estimate is uncertain. Estimate the "
            "number of meal-sized portions visible; for mixed scenes, use a "
            "conservative approximate total of visibly countable portions and assign "
            "low confidence. Do not claim precision, count hidden contents, or "
            "derive servings from opaque packages, shelf capacity, weight, or volume. "
            "Return null only when the image gives no reasonable visual basis for "
            "any portion estimate, with confidence 0. The donor must review and "
            "correct every estimate before using it. Never infer ingredients, "
            "preparation time, storage, safety, expiry, edibility, or legal "
            "eligibility. Return confidence from 0 to 1 for every field; confidence "
            "for an empty list must be 0."
        )
        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=self.settings.vertex_ai_location,
            http_options=types.HttpOptions(
                timeout=int(self.settings.request_timeout_seconds * 1000),
            ),
        )
        response = client.models.generate_content(
            model=self.settings.gemini_model,
            contents=[
                prompt,
                types.Part.from_bytes(data=image, mime_type=content_type),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA,
                temperature=0.1,
            ),
        )
        if not response.text:
            raise ValueError("Gemini returned an empty response")
        parsed = GeminiFoodPassportOutput.model_validate_json(response.text)
        return parsed.model_dump(by_alias=True)

    def _to_field_values(self, response: dict[str, Any]) -> dict[str, FieldValue]:
        response = GeminiFoodPassportOutput.model_validate(response).model_dump(
            by_alias=True,
        )
        fields = {
            "name": str,
            "category": str,
            "visiblePackaging": str,
            "dietaryTags": list,
            "potentialAllergens": list,
        }
        confidence = response["confidence"]
        values: dict[str, FieldValue] = {}
        for name, expected_type in fields.items():
            value = response[name]
            if expected_type is list:
                if not isinstance(value, list) or not all(
                    isinstance(item, str) for item in value
                ):
                    raise ValueError(f"Invalid Gemini value for {name}")
            elif value is not None and not isinstance(value, expected_type):
                raise ValueError(f"Invalid Gemini value for {name}")
            score = float(confidence[name])
            if not 0 <= score <= 1:
                raise ValueError(f"Invalid Gemini confidence for {name}")
            has_value = value not in (None, "", [])
            source = (
                Source.AI_SUGGESTED
                if has_value and score > 0
                else Source.UNKNOWN
            )
            values[name] = FieldValue(
                value=value,
                source=source,
                confidence=score if source == Source.AI_SUGGESTED else 0.0,
            )
        quantity_suggestion = response["quantitySuggestion"]
        quantity_confidence = float(confidence["quantitySuggestion"])
        quantity_source = (
            Source.AI_SUGGESTED
            if quantity_suggestion is not None
            else Source.UNKNOWN
        )
        values["quantitySuggestion"] = FieldValue(
            value=quantity_suggestion,
            source=quantity_source,
            confidence=(
                quantity_confidence if quantity_source == Source.AI_SUGGESTED else 0.0
            ),
        )
        return values

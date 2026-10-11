from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import Any

from app.api import errors
from app.config import get_settings
from app.models.analysis import FoodAnalysis
from app.models.common import FieldValue, Source, utc_now
from app.repositories.memory import InMemoryRepository
from app.utils.ids import new_id

logger = logging.getLogger(__name__)
SAFETY_NOTICE = (
    "Visual analysis does not determine food safety or confirm ingredients."
)
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "name": {"type": "STRING", "nullable": True},
        "category": {
            "type": "STRING",
            "enum": ["prepared_meal", "bakery", "produce", "packaged_food", "other"],
        },
        "visiblePackaging": {"type": "STRING", "nullable": True},
        "dietaryTags": {"type": "ARRAY", "items": {"type": "STRING"}},
        "potentialAllergens": {"type": "ARRAY", "items": {"type": "STRING"}},
        "confidence": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "NUMBER"},
                "category": {"type": "NUMBER"},
                "visiblePackaging": {"type": "NUMBER"},
                "dietaryTags": {"type": "NUMBER"},
                "potentialAllergens": {"type": "NUMBER"},
            },
            "required": [
                "name",
                "category",
                "visiblePackaging",
                "dietaryTags",
                "potentialAllergens",
            ],
        },
    },
    "required": [
        "name",
        "category",
        "visiblePackaging",
        "dietaryTags",
        "potentialAllergens",
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
            "Inspect this food image and suggest only visually observable details. "
            "Do not infer food safety, preparation time, storage, quantity, expiry, "
            "or legal eligibility. Return a short food name when recognizable, one "
            "category from the allowed values, visible packaging when recognizable, "
            "and dietary tags or potential allergens only when visually supported. "
            "A food image cannot confirm ingredients or allergens. Use empty arrays "
            "when there is no visual evidence. Include a separate confidence from 0 "
            "to 1 for each suggested field."
        )
        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=self.settings.vertex_ai_location,
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
        return json.loads(response.text)

    def _to_field_values(self, response: dict[str, Any]) -> dict[str, FieldValue]:
        fields = {
            "name": str | type(None),
            "category": str,
            "visiblePackaging": str | type(None),
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
            source = Source.AI_SUGGESTED if value not in (None, []) else Source.UNKNOWN
            values[name] = FieldValue(
                value=value,
                source=source,
                confidence=score if source == Source.AI_SUGGESTED else 0.0,
            )
        values["quantitySuggestion"] = FieldValue(
            value=None,
            source=Source.UNKNOWN,
            confidence=0.0,
        )
        return values

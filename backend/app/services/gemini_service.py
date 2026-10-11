from app.api import errors
from app.config import get_settings
from app.models.analysis import FoodAnalysis
from app.models.common import FieldValue, Source, utc_now
from app.repositories.memory import InMemoryRepository
from app.utils.ids import new_id
from datetime import timedelta


class GeminiService:
    def __init__(self, repository: InMemoryRepository) -> None:
        self.repository = repository
        self.settings = get_settings()

    def analyze(self, owner_uid: str, image: bytes, filename: str, content_type: str) -> FoodAnalysis:
        if not content_type.startswith("image/"):
            raise errors.SecondServeError(415, "UNSUPPORTED_IMAGE", "Only image files are supported.")
        if len(image) > self.settings.max_upload_bytes:
            raise errors.SecondServeError(413, "IMAGE_TOO_LARGE", "The image exceeds the configured size limit.")
        now = utc_now()
        analysis = FoodAnalysis(
            analysis_id=new_id("an"), owner_uid=owner_uid, image_path=None,
            expires_at=now + timedelta(hours=24),
            candidate={
                "name": FieldValue(value="Vegetarian prepared meal", source=Source.AI_SUGGESTED, confidence=0.88),
                "category": FieldValue(value="prepared_meal", source=Source.AI_SUGGESTED, confidence=0.84),
                "visiblePackaging": FieldValue(value="sealed_container", source=Source.AI_SUGGESTED, confidence=0.72),
                "dietaryTags": FieldValue(value=["vegetarian"], source=Source.AI_SUGGESTED, confidence=0.70),
                "potentialAllergens": FieldValue(value=["wheat", "dairy"], source=Source.AI_SUGGESTED, confidence=0.62),
                "quantitySuggestion": FieldValue(value=None, source=Source.UNKNOWN, confidence=0.0),
            },
            required_confirmations=["name", "category", "quantity", "unit", "allergenStatus", "preparedAt", "storageCondition", "pickupAvailableAt", "usableUntil"],
            safety_notice="Visual analysis does not determine food safety or confirm ingredients.",
            created_at=now, updated_at=now,
        )
        return self.repository.create_analysis(analysis)

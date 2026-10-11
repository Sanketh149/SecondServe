from fastapi import APIRouter, Depends, UploadFile
from app.api.dependencies import require_role
from app.api import errors
from app.models.user import CurrentUser
from app.repositories.memory import get_repository
from app.schemas.analysis import AnalysisResponse
from app.services.gemini_service import GeminiService
from app.config import get_settings

router = APIRouter(prefix="/donations/analyze")

@router.post("", response_model=AnalysisResponse)
async def analyze_image(
    file: UploadFile,
    user: CurrentUser = Depends(require_role("donor")),
) -> AnalysisResponse:
    content_type = file.content_type or ""
    image = await file.read(get_settings().max_upload_bytes + 1)
    analysis = GeminiService(get_repository()).analyze(user.uid, image, file.filename or "upload", content_type)
    return AnalysisResponse(
        analysis_id=analysis.analysis_id,
        expires_at=analysis.expires_at,
        candidate=analysis.candidate,
        required_confirmations=analysis.required_confirmations,
        safety_notice=analysis.safety_notice,
    )

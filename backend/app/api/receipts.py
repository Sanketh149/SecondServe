from fastapi import APIRouter, Depends
from app.api import errors
from app.api.dependencies import require_role
from app.models.user import CurrentUser
from app.models.receipt import ReceiptRequest
from app.repositories.memory import get_repository
from app.schemas.receipt import ReceiptResponse
from app.services.receipt_service import ReceiptService

router = APIRouter(prefix="/allocations")

@router.post("/{allocation_id}/receipt", response_model=ReceiptResponse)
def submit_receipt(allocation_id: str, request: ReceiptRequest, user: CurrentUser = Depends(require_role("recipient"))) -> ReceiptResponse:
    return ReceiptService(get_repository()).submit(allocation_id, request, user.organization_id)

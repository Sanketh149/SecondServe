from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from typing import Any


class SecondServeError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.request_id = ""


def error_response(exc: SecondServeError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "requestId": exc.request_id,
            }
        },
    )


def request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "") or "unknown"

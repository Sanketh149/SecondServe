from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    analysis,
    donations,
    errors,
    forecast,
    health,
    impact,
    offers,
    receipts,
    recipients,
    rescue_plans,
    tasks,
    users,
)
from app.config import get_settings
from app.utils.ids import new_id

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.demo_mode:
        from app.repositories import memory

        memory.initialize_demo_data()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="SecondServe food rescue API",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(donations.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(rescue_plans.router, prefix="/api/v1")
app.include_router(offers.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(impact.router, prefix="/api/v1")
app.include_router(forecast.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(recipients.router, prefix="/api/v1")


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = new_id("req")
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(errors.SecondServeError)
async def secondserve_error_handler(request: Request, exc: errors.SecondServeError):
    exc.request_id = getattr(request.state, "request_id", new_id("req"))
    return errors.error_response(exc)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "The request contains invalid or missing fields.",
                "details": {"errors": jsonable_encoder(exc.errors())},
                "requestId": getattr(request.state, "request_id", new_id("req")),
            }
        },
    )

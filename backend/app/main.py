from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import dependencies, errors, health, users, donations, analysis, rescue_plans, offers, receipts, impact, forecast
from app.config import get_settings

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="SecondServe food rescue API",
    dependency_overrides={dependencies.get_current_user: dependencies.get_current_user},
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.exception_handler(errors.SecondServeError)
async def secondserve_error_handler(_, exc: errors.SecondServeError):
    return errors.error_response(exc)

@app.on_event("startup")
async def startup() -> None:
    from app.repositories import memory

    memory.initialize_demo_data()

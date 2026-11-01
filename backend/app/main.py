from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import districts, health, satellite
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Research-oriented Maharashtra drought monitoring API. "
        "Unavailable live sources are reported explicitly; no synthetic fallback is implicit."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(districts.router, prefix=settings.api_prefix)
app.include_router(satellite.router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "health": f"{settings.api_prefix}/health",
        "documentation": "/docs",
    }


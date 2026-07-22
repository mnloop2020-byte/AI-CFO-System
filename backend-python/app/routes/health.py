from fastapi import APIRouter, HTTPException, status

from app.config.settings import (
    OPENROUTER_API_KEY,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL,
)

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/live")
def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
def readiness():
    if not all((SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OPENROUTER_API_KEY)):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Required services are not configured.",
        )
    return {"status": "ready"}


@router.get("/about")
def about():
    return {
        "project": "AI CFO System",
        "backend": "Python FastAPI",
        "version": "1.0",
    }

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.security.utils import get_authorization_scheme_param
from prometheus_client import CONTENT_TYPE_LATEST

from app.config.settings import (
    METRICS_BEARER_TOKEN,
    OPENROUTER_API_KEY,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_URL,
)
from app.monitoring.metrics import metrics, valid_metrics_token

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/live")
def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(request: Request):
    configuration_ready = bool(
        all((SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OPENROUTER_API_KEY))
    )
    metrics.set_dependency("configuration", configuration_ready)
    if not configuration_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Required services are not configured.",
        )
    rate_limiter_ready = await request.app.state.rate_limiter.ready()
    metrics.set_dependency("rate_limiter", rate_limiter_ready)
    if not rate_limiter_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Request protection service is unavailable.",
        )
    return {"status": "ready"}


@router.get("/internal/metrics", include_in_schema=False)
def monitoring_metrics(request: Request):
    scheme, credentials = get_authorization_scheme_param(
        request.headers.get("Authorization")
    )
    if (
        scheme.lower() != "bearer"
        or not valid_metrics_token(credentials, METRICS_BEARER_TOKEN)
    ):
        if METRICS_BEARER_TOKEN is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Metrics collection is not configured.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Metrics authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Response(
        content=metrics.render(),
        headers={
            "Cache-Control": "no-store",
            "Content-Type": CONTENT_TYPE_LATEST,
        },
    )


@router.get("/about")
def about():
    return {
        "project": "AI CFO System",
        "backend": "Python FastAPI",
        "version": "1.0",
    }

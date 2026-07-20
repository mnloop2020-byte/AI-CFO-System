from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.security.authentication import require_authenticated_request
from app.security.request_context import RequestContext


router = APIRouter(prefix="/auth", tags=["auth"])


class AuthMeResponse(BaseModel):
    user_id: str
    company_id: str
    role: str


@router.get("/me", response_model=AuthMeResponse)
async def get_authenticated_user(
    context: RequestContext = Depends(require_authenticated_request),
) -> AuthMeResponse:
    """Return identity and membership resolved only from the Bearer token."""
    return AuthMeResponse(
        user_id=context.user_id,
        company_id=context.company_id,
        role=context.company_role,
    )

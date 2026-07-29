from fastapi import APIRouter, Depends, Query

from app.schemas.audit_schema import SecurityAuditEventResponse
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.services.audit_store import list_security_audit_events


router = APIRouter(prefix="/audit", tags=["security audit"])


@router.get("/events", response_model=list[SecurityAuditEventResponse])
def get_security_audit_events(
    limit: int = Query(default=100, ge=1, le=200),
    _: RequestContext = Depends(require_permission("audit.read")),
) -> list[SecurityAuditEventResponse]:
    return list_security_audit_events(limit)

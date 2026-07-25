import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.notification_schema import (
    NotificationResponse,
    NotificationScanResult,
)
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.services.notification_store import (
    list_notifications,
    scan_overdue_invoice_notifications,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def get_notifications(
    _: RequestContext = Depends(require_permission("financial.read")),
) -> list[NotificationResponse]:
    try:
        return list_notifications()
    except Exception as error:
        logger.exception("Unable to list notifications.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Notifications are unavailable.",
        ) from error


@router.post("/scan-overdue", response_model=NotificationScanResult)
def scan_overdue_notifications(
    _: RequestContext = Depends(require_permission("financial.write")),
) -> NotificationScanResult:
    try:
        return NotificationScanResult(
            created=scan_overdue_invoice_notifications(),
        )
    except Exception as error:
        logger.exception("Unable to scan overdue invoice notifications.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The overdue invoice scan is unavailable.",
        ) from error

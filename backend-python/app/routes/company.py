import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.company_schema import CompanySettingsResponse, CompanySettingsUpdate
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.services.company_store import get_company_settings, update_company_settings


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/company", tags=["company"])


@router.get("/settings", response_model=CompanySettingsResponse)
def read_company_settings(
    _: RequestContext = Depends(require_permission("company.read")),
) -> CompanySettingsResponse:
    try:
        return get_company_settings()
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to read company settings.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Company settings are unavailable.",
        ) from error


@router.patch("/settings", response_model=CompanySettingsResponse)
def save_company_settings(
    payload: CompanySettingsUpdate,
    _: RequestContext = Depends(require_permission("company.update")),
) -> CompanySettingsResponse:
    try:
        return update_company_settings(payload)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to update company settings.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Company settings could not be saved.",
        ) from error


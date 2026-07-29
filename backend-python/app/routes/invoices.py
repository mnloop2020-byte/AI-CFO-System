import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.schemas.invoices_schema import (
    InvoiceCreate,
    InvoiceEmailRequest,
    InvoiceEmailResult,
    InvoicePdfDownload,
    InvoicePdfRequest,
    InvoiceResponse,
)
from app.services.email_service import (
    EmailDeliveryError,
    EmailNotConfiguredError,
)
from app.services.invoice_delivery_service import (
    create_invoice_pdf_download,
    send_invoice_email,
)
from app.services.invoices_store import (
    create_invoice,
    delete_invoice,
    get_invoices,
    update_invoice,
    InvoiceUpdate 
)
from app.services.notification_store import create_paid_notification
from app.services.store_errors import RecordConflictError, RecordNotFoundError


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("", response_model=InvoiceResponse)
def add_invoice(
    invoice: InvoiceCreate,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        new_invoice = create_invoice(invoice)
    except RecordConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    return new_invoice
    # Create a new invoice and return it.


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    _: RequestContext = Depends(require_permission("financial.read")),
):
    invoices = get_invoices()

    return invoices
    # Get all invoices from Supabase.




@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def edit_invoice(
    invoice_id: str,
    invoice: InvoiceUpdate,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        updated_invoice = update_invoice(
            invoice_id=invoice_id,
            invoice=invoice,
        )
        if updated_invoice.status == "paid":
            try:
                create_paid_notification(
                    invoice_id=updated_invoice.id,
                    invoice_number=updated_invoice.invoice_number,
                    revision=updated_invoice.updated_at or updated_invoice.id,
                )
            except Exception:
                logger.exception("Unable to create an invoice-paid notification.")

        return updated_invoice
        # Update one invoice and return it.

    except RecordConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except RecordNotFoundError:
        raise HTTPException (
            status_code=404,
            detail="Invoice not found",
        )
        # Return 404 if the invoice ID does not exist.


@router.post(
    "/{invoice_id}/pdf/download",
    response_model=InvoicePdfDownload,
)
def download_invoice_pdf(
    invoice_id: UUID,
    request: InvoicePdfRequest,
    _: RequestContext = Depends(require_permission("financial.read")),
) -> InvoicePdfDownload:
    try:
        return create_invoice_pdf_download(
            invoice_id,
            language=request.language,
        )
    except RecordNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        ) from error
    except RecordConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except Exception as error:
        logger.exception("Unable to prepare an invoice PDF download.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invoice PDF download is unavailable.",
        ) from error


@router.post(
    "/{invoice_id}/email",
    response_model=InvoiceEmailResult,
)
def email_invoice(
    invoice_id: UUID,
    request: InvoiceEmailRequest,
    _: RequestContext = Depends(require_permission("financial.write")),
) -> InvoiceEmailResult:
    try:
        send_invoice_email(
            invoice_id,
            language=request.language,
        )
        return InvoiceEmailResult(
            status="sent",
            message="Invoice email sent successfully.",
        )
    except RecordNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except RecordConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except EmailNotConfiguredError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except EmailDeliveryError as error:
        logger.warning("Invoice email delivery failed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The email provider could not deliver the invoice.",
        ) from error
    except Exception as error:
        logger.exception("Unexpected invoice email delivery failure.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invoice email delivery is unavailable.",
        ) from error

@router.delete("/{invoice_id}")
def remove_invoice(
    invoice_id: str,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        delete_invoice(invoice_id)

        return {
            "message": "Invoice deleted successfully",
            "invoice_id": invoice_id,
        }
        # Delete one invoice and return a success message.

    except RecordConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except RecordNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )
        # Return 404 if the invoice ID does not exist.





# Note: This route file handles invoice API requests.

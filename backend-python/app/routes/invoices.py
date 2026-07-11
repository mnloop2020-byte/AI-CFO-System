from fastapi import APIRouter , HTTPException

from app.schemas.invoices_schema import InvoiceCreate, InvoiceResponse
from app.services.invoices_store import (
    create_invoice,
    delete_invoice,
    get_invoices,
    update_invoice,
    InvoiceUpdate 
)
router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("", response_model=InvoiceResponse)
def add_invoice(invoice: InvoiceCreate):
    new_invoice = create_invoice(invoice)

    return new_invoice
    # Create a new invoice and return it.


@router.get("", response_model=list[InvoiceResponse])
def list_invoices():
    invoices = get_invoices()

    return invoices
    # Get all invoices from Supabase.




@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def edit_invoice(invoice_id: str, invoice: InvoiceUpdate):
    try:
        updated_invoice = update_invoice(
            invoice_id=invoice_id,
            invoice=invoice,
        )

        return updated_invoice
        # Update one invoice and return it.

    except ValueError:
        raise HTTPException (
            status_code=404,
            detail="Invoice not found",
        )
        # Return 404 if the invoice ID does not exist.

@router.delete("/{invoice_id}")
def remove_invoice(invoice_id: str):
    try:
        delete_invoice(invoice_id)

        return {
            "message": "Invoice deleted successfully",
            "invoice_id": invoice_id,
        }
        # Delete one invoice and return a success message.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )
        # Return 404 if the invoice ID does not exist.





# Note: This route file handles invoice API requests.
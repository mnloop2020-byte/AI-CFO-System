from datetime import datetime, timezone
from app.schemas.invoices_schema import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
)
from app.services.supabase_client import get_supabase_client
from app.services.store_errors import (
    RecordConflictError,
    RecordNotFoundError,
    is_constraint_error,
)


def _ensure_unique_invoice_number(
    invoice_number: str | None,
    *,
    excluding_id: str | None = None,
) -> None:
    if not invoice_number:
        return
    query = (
        get_supabase_client()
        .table("invoices")
        .select("id")
        .ilike("invoice_number", invoice_number)
    )
    if excluding_id:
        query = query.neq("id", excluding_id)
    if query.limit(1).execute().data:
        raise RecordConflictError("An invoice with this number already exists.")


def _effective_status(status: str, due_date: str | None) -> str:
    normalized = status.strip().lower()
    if normalized != "unpaid" or not due_date:
        return normalized
    try:
        due = datetime.fromisoformat(due_date.replace("Z", "+00:00")).date()
    except ValueError:
        return normalized
    return "overdue" if due < datetime.now(timezone.utc).date() else normalized


def _invoice_response(row: dict[str, object]) -> InvoiceResponse:
    return InvoiceResponse(
        id=str(row["id"]),
        customer_id=str(row["customer_id"]) if row.get("customer_id") else None,
        invoice_number=str(row["invoice_number"]),
        total_amount=float(row["total_amount"]),
        vat_amount=float(row["vat_amount"]),
        status=_effective_status(str(row["status"]), str(row["due_date"]) if row.get("due_date") else None),
        due_date=str(row["due_date"]) if row.get("due_date") else None,
        file_url=str(row["file_url"]) if row.get("file_url") else None,
        created_at=str(row["created_at"]) if row.get("created_at") else None,
        updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
    )


def create_invoice(invoice: InvoiceCreate) -> InvoiceResponse:
    supabase = get_supabase_client()
    _ensure_unique_invoice_number(invoice.invoice_number)

    response = (
        supabase
        .table("invoices")
        .insert(invoice.model_dump())
        .execute()
    )

    row = response.data[0]

    return _invoice_response(row)
    # Creates a new invoice in Supabase and returns it.


def get_invoices() -> list[InvoiceResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("invoices")
        .select(
            "id, customer_id, invoice_number, total_amount, vat_amount, status, due_date, file_url, created_at, updated_at"
        )
        .order("created_at", desc=True)
        .execute()
    )

    return [
        _invoice_response(row)
        for row in response.data
    ]
    # Gets all invoices from Supabase.


def update_invoice(
    invoice_id: str,
    invoice: InvoiceUpdate,
) -> InvoiceResponse:
    supabase = get_supabase_client()
    current_response = (
        supabase
        .table("invoices")
        .select("total_amount,vat_amount")
        .eq("id", invoice_id)
        .limit(1)
        .execute()
    )
    if not current_response.data:
        raise RecordNotFoundError("Invoice not found")

    if invoice.invoice_number is not None:
        _ensure_unique_invoice_number(invoice.invoice_number, excluding_id=invoice_id)

    update_data = invoice.model_dump(exclude_none=True)
    # Keep only the invoice fields sent by the user.

    current = current_response.data[0]
    effective_total = float(update_data.get("total_amount", current["total_amount"]))
    effective_vat = float(update_data.get("vat_amount", current["vat_amount"]))
    if effective_vat > effective_total:
        raise RecordConflictError("VAT amount cannot exceed total amount.")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Update the last modified time.

    response = (
        supabase
        .table("invoices")
        .update(update_data)
        .eq("id", invoice_id)
        .execute()
    )

    if not response.data:
        raise RecordNotFoundError("Invoice not found")
    # Stop if no invoice was found with this ID.

    row = response.data[0]

    return _invoice_response(row)
    # Update one invoice and return the updated invoice.

def delete_invoice(invoice_id: str) ->  None:
    supabase = get_supabase_client()

    try:
        response = (
            supabase
            .table("invoices")
            .delete()
            .eq("id", invoice_id)
            .execute()
        )
    except Exception as error:
        if is_constraint_error(error, "23503"):
            raise RecordConflictError(
                "Invoice is linked to another record and cannot be deleted."
            ) from error
        raise

    if not response.data:
        raise RecordNotFoundError("Invoice not found")
    # Stop if no invoice was found with this ID. 404 


# Note: This function deletes one invoice from Supabase.


# Note: This file saves and reads invoices from Supabase.

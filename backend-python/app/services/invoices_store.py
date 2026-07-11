from supabase import Client, create_client
from datetime import datetime, timezone
from app.config.settings import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from app.schemas.invoices_schema import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
)

def get_supabase_client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing. Add it to backend-python/.env")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to backend-python/.env"
        )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    # Creates and returns the Supabase client.


def create_invoice(invoice: InvoiceCreate) -> InvoiceResponse:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("invoices")
        .insert(invoice.model_dump())
        .execute()
    )

    row = response.data[0]

    return InvoiceResponse(
        id=row["id"],
        customer_id=row.get("customer_id"),
        invoice_number=row["invoice_number"],
        total_amount=float(row["total_amount"]),
        vat_amount=float(row["vat_amount"]),
        status=row["status"],
        due_date=row.get("due_date"),
        file_url=row.get("file_url"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
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
        InvoiceResponse(
            id=row["id"],
            customer_id=row.get("customer_id"),
            invoice_number=row["invoice_number"],
            total_amount=float(row["total_amount"]),
            vat_amount=float(row["vat_amount"]),
            status=row["status"],
            due_date=row.get("due_date"),
            file_url=row.get("file_url"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
    # Gets all invoices from Supabase.


def update_invoice(
    invoice_id: str,
    invoice: InvoiceUpdate,
) -> InvoiceResponse:
    supabase = get_supabase_client()

    update_data = invoice.model_dump(exclude_none=True)
    # Keep only the invoice fields sent by the user.

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
        raise ValueError("Invoice not found")
    # Stop if no invoice was found with this ID.

    row = response.data[0]

    return InvoiceResponse(
        id=row["id"],
        customer_id=row.get("customer_id"),
        invoice_number=row["invoice_number"],
        total_amount=float(row["total_amount"]),
        vat_amount=float(row["vat_amount"]),
        status=row["status"],
        due_date=row.get("due_date"),
        file_url=row.get("file_url"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Update one invoice and return the updated invoice.

def delete_invoice(invoice_id: str) ->  None:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("invoices")
        .delete()
        .eq("id", invoice_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Invoice not found")
    # Stop if no invoice was found with this ID. 404 


# Note: This function deletes one invoice from Supabase.


# Note: This file saves and reads invoices from Supabase.
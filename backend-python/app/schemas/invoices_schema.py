from pydantic import BaseModel


class InvoiceCreate(BaseModel):
    customer_id: str | None = None
    invoice_number: str
    total_amount: float
    vat_amount: float = 0
    status: str = "unpaid"
    due_date: str | None = None
    file_url: str | None = None


class InvoiceResponse(BaseModel):
    id: str
    customer_id: str | None = None
    invoice_number: str
    total_amount: float
    vat_amount: float
    status: str
    due_date: str | None = None
    file_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class InvoiceUpdate(BaseModel):
    customer_id: str | None = None
    invoice_number: str | None = None
    total_amount: float | None = None
    vat_amount: float | None = None
    status: str | None = None
    due_date: str | None = None
    file_url: str | None = None



# Note: This file defines the invoice request and response data shapes.
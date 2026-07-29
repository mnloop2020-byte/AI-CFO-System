from decimal import Decimal

from app.money import sum_money
from app.schemas.invoices_schema import InvoiceResponse
from app.services.invoices_store import get_invoices

def get_tax_summary(
    invoices: list[InvoiceResponse] | None = None,
) -> dict:
    if invoices is None:
        invoices = get_invoices()

    vat_by_status: dict[str, dict] = {}

    for invoice in invoices:
        status = invoice.status.lower()

        if status not in vat_by_status:
            vat_by_status[status] = {
                "invoice_count": 0,
                "invoice_amount": Decimal("0.00"),
                "vat_amount": Decimal("0.00"),
            }

        vat_by_status[status]["invoice_count"] += 1
        vat_by_status[status]["invoice_amount"] += invoice.total_amount
        vat_by_status[status]["vat_amount"] += invoice.vat_amount

    return {
        "invoice_count": len(invoices),
        "total_invoiced_vat": sum_money(
            invoice.vat_amount for invoice in invoices
        ),
        "vat_by_invoice_status": vat_by_status,
        "input_vat_available": False,
        "net_vat_payable_available": False,
        "tax_jurisdiction_configured": False,
        "data_sources": [
            {
                "table": "invoices",
                "record_ids": [invoice.id for invoice in invoices],
                "calculation": "total_invoiced_vat = sum(vat_amount)",
            }
        ],
    }


# Note: This tool summarizes VAT recorded on invoices while clearly marking unavailable input VAT, net VAT payable, and tax jurisdiction.

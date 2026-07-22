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
                "invoice_amount": 0.0,
                "vat_amount": 0.0,
            }

        vat_by_status[status]["invoice_count"] += 1
        vat_by_status[status]["invoice_amount"] += float(
            invoice.total_amount
        )
        vat_by_status[status]["vat_amount"] += float(
            invoice.vat_amount
        )

    for status_data in vat_by_status.values():
        status_data["invoice_amount"] = round(
            status_data["invoice_amount"],
            2,
        )
        status_data["vat_amount"] = round(
            status_data["vat_amount"],
            2,
        )

    return {
        "invoice_count": len(invoices),
        "total_invoiced_vat": round(
            sum(float(invoice.vat_amount) for invoice in invoices),
            2,
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

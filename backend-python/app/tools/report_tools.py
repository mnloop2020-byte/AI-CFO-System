from app.tools.accounting_tools import get_accounting_summary
from app.tools.cashflow_tools import get_cashflow_summary
from app.tools.fraud_tools import get_fraud_risk_summary
from app.tools.inventory_tools import get_inventory_analysis
from app.tools.sales_tools import get_sales_summary
from app.tools.tax_tools import get_tax_summary
from app.services.expenses_store import get_expenses
from app.services.invoices_store import get_invoices

def get_cfo_report_data() -> dict:
    sales_summary = get_sales_summary()
    expenses = get_expenses()
    invoices = get_invoices()
    inventory_analysis = get_inventory_analysis()

    return {
        "sales": sales_summary,
        "inventory": inventory_analysis,
        "accounting": get_accounting_summary(
            sales_summary=sales_summary,
            expenses=expenses,
            invoices=invoices,
        ),
        "cash_flow": get_cashflow_summary(
            expenses=expenses,
            invoices=invoices,
        ),
        "tax": get_tax_summary(invoices=invoices),
        "fraud_risk": get_fraud_risk_summary(
            expenses=expenses,
            invoices=invoices,
        ),
        "data_sources": [
            *sales_summary.get("data_sources", []),
            {
                "table": "expenses",
                "record_ids": [expense.id for expense in expenses],
                "calculation": "expense totals and review flags",
            },
            {
                "table": "invoices",
                "record_ids": [invoice.id for invoice in invoices],
                "calculation": "invoice statuses, receivables, cash inflows, and invoiced VAT",
            },
            *inventory_analysis.get("data_sources", []),
        ],
    }

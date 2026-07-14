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

    return {
        "sales": sales_summary,
        "inventory": get_inventory_analysis(),
        "accounting": get_accounting_summary(
            sales_summary=sales_summary,
            expenses=expenses,
            invoices=invoices,
        ),
        "cash_flow": get_cashflow_summary(
            expenses=expenses,
            invoices=invoices,
        ),
        "tax": get_tax_summary(),
      "fraud_risk": get_fraud_risk_summary(
    expenses=expenses,
    invoices=invoices,
),
    }

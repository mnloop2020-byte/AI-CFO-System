from app.schemas.sales_schema import SaleResponse
from app.services.sales_store import get_sales


def get_sales_summary(
    sales: list[SaleResponse] | None = None,
) -> dict:
    if sales is None:
        sales = get_sales()

    completed_sales = [
        sale
        for sale in sales
        if sale.status.lower() == "completed"
    ]

    product_performance: dict[str, dict] = {}

    for sale in completed_sales:
        product_name = sale.product_name

        if product_name not in product_performance:
            product_performance[product_name] = {
                "product_name": product_name,
                "units_sold": 0,
                "revenue": 0.0,
            }

        product_performance[product_name]["units_sold"] += sale.quantity
        product_performance[product_name]["revenue"] += float(
            sale.total_amount
        )

    top_products = sorted(
        product_performance.values(),
        key=lambda product: product["revenue"],
        reverse=True,
    )[:5]

    for product in top_products:
        product["revenue"] = round(product["revenue"], 2)

    status_breakdown: dict[str, dict] = {}

    for sale in sales:
        status = sale.status.lower()

        if status not in status_breakdown:
            status_breakdown[status] = {
                "count": 0,
                "value": 0.0,
            }

        status_breakdown[status]["count"] += 1
        status_breakdown[status]["value"] += float(sale.total_amount)

    for status_data in status_breakdown.values():
        status_data["value"] = round(status_data["value"], 2)

    return {
        "total_sales_records": len(sales),
        "completed_sales_count": len(completed_sales),
        "total_units_sold": sum(
            sale.quantity
            for sale in completed_sales
        ),
        "completed_revenue": round(
            sum(
                float(sale.total_amount)
                for sale in completed_sales
            ),
            2,
        ),
        "total_recorded_sales_value": round(
            sum(float(sale.total_amount) for sale in sales),
            2,
        ),
        "status_breakdown": status_breakdown,
        "top_products": top_products,
        "data_sources": [
            {
                "table": "sales",
                "record_ids": [sale.id for sale in sales],
                "calculation": (
                    "completed_revenue = sum(total_amount) where status is completed"
                ),
            }
        ],
    }

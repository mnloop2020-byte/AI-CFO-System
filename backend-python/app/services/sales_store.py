from datetime import datetime, timezone

from app.schemas.sales_schema import SaleCreate, SaleResponse , SaleUpdate 
from app.services.supabase_client import get_supabase_client


def create_sale(sale: SaleCreate) -> SaleResponse:
    supabase = get_supabase_client()

    total_amount = sale.quantity * sale.unit_price
    # Calculate the total sale amount.

    sale_data = sale.model_dump()
    sale_data["total_amount"] = total_amount
    # Add total_amount before saving to Supabase.

    response = (
        supabase
        .table("sales")
        .insert(sale_data)
        .execute()
    )

    row = response.data[0]

    return SaleResponse(
        id=row["id"],
        customer_id=row.get("customer_id"),
        product_name=row["product_name"],
        quantity=row["quantity"],
        unit_price=float(row["unit_price"]),
        total_amount=float(row["total_amount"]),
        status=row["status"],
        sale_date=row.get("sale_date"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Creates a new sale in Supabase and returns it.


def get_sales() -> list[SaleResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("sales")
        .select(
            "id, customer_id, product_name, quantity, unit_price, total_amount, status, sale_date, created_at, updated_at"
        )
        .order("sale_date", desc=True)
        .execute()
    )

    return [
        SaleResponse(
            id=row["id"],
            customer_id=row.get("customer_id"),
            product_name=row["product_name"],
            quantity=row["quantity"],
            unit_price=float(row["unit_price"]),
            total_amount=float(row["total_amount"]),
            status=row["status"],
            sale_date=row.get("sale_date"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
    # Gets all sales from Supabase.

def update_sale(
    sale_id: str,
    sale: SaleUpdate,
) -> SaleResponse:
    supabase = get_supabase_client()

    old_response = (
        supabase
        .table("sales")
        .select("quantity, unit_price")
        .eq("id", sale_id)
        .execute()
    )

    if not old_response.data:
        raise ValueError("Sale not found")
    # Stop if no sale was found with this ID.

    old_sale = old_response.data[0]

    update_data = sale.model_dump(exclude_none=True)
    # Keep only the fields the user wants to update.

    quantity = update_data.get("quantity", old_sale["quantity"])
    unit_price = update_data.get("unit_price", old_sale["unit_price"])
    # Use new values if provided, otherwise use old values.

    update_data["total_amount"] = quantity * float(unit_price)
    # Recalculate total_amount after update.

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Update the last modified time.

    response = (
        supabase
        .table("sales")
        .update(update_data)
        .eq("id", sale_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Sale not found")
    # Stop if update did not return a sale.

    row = response.data[0]

    return SaleResponse(
        id=row["id"],
        customer_id=row.get("customer_id"),
        product_name=row["product_name"],
        quantity=row["quantity"],
        unit_price=float(row["unit_price"]),
        total_amount=float(row["total_amount"]),
        status=row["status"],
        sale_date=row.get("sale_date"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Updates one sale in Supabase and returns the updated sale.



def delete_sale(sale_id: str) -> None:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("sales")
        .delete()
        .eq("id", sale_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Sale not found")
    # Stop if no sale was found with this ID.


# Note: This function deletes one sale from Supabase.


# Note: This file saves and reads sales from Supabase.

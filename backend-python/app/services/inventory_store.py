from datetime import datetime, timezone

from supabase import Client, create_client

from app.config.settings import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from app.schemas.inventory_schema import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
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


def create_inventory_item(item: InventoryCreate) -> InventoryResponse:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("inventory")
        .insert(item.model_dump())
        .execute()
    )

    row = response.data[0]

    return InventoryResponse(
        id=row["id"],
        product_name=row["product_name"],
        sku=row.get("sku"),
        quantity=row["quantity"],
        reorder_level=row["reorder_level"],
        cost_price=float(row["cost_price"]),
        selling_price=float(row["selling_price"]),
        last_sold=row.get("last_sold"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Creates a new inventory item in Supabase and returns it.


def get_inventory_items() -> list[InventoryResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("inventory")
        .select(
            "id, product_name, sku, quantity, reorder_level, cost_price, selling_price, last_sold, created_at, updated_at"
        )
        .order("created_at", desc=True)
        .execute()
    )

    return [
        InventoryResponse(
            id=row["id"],
            product_name=row["product_name"],
            sku=row.get("sku"),
            quantity=row["quantity"],
            reorder_level=row["reorder_level"],
            cost_price=float(row["cost_price"]),
            selling_price=float(row["selling_price"]),
            last_sold=row.get("last_sold"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
    # Gets all inventory items from Supabase.


def update_inventory_item(
    item_id: str,
    item: InventoryUpdate,
) -> InventoryResponse:
    supabase = get_supabase_client()

    update_data = item.model_dump(exclude_none=True)
    # Keep only the fields the user wants to update.

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Update the last modified time.

    response = (
        supabase
        .table("inventory")
        .update(update_data)
        .eq("id", item_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Inventory item not found")
    # Stop if no item was found with this ID.

    row = response.data[0]

    return InventoryResponse(
        id=row["id"],
        product_name=row["product_name"],
        sku=row.get("sku"),
        quantity=row["quantity"],
        reorder_level=row["reorder_level"],
        cost_price=float(row["cost_price"]),
        selling_price=float(row["selling_price"]),
        last_sold=row.get("last_sold"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Updates one inventory item in Supabase and returns the updated item.



def delete_inventory_item(item_id: str) -> None:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("inventory")
        .delete()
        .eq("id", item_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Inventory item not found")
    # Stop if no inventory item was found with this ID.


# Note: This function deletes one inventory item from Supabase.


def get_low_inventory_items() -> list[InventoryResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("inventory")
        .select(
            "id, product_name, sku, quantity, reorder_level, "
            "cost_price, selling_price, last_sold, created_at, updated_at"
        )
        .execute()
    )

    low_inventory_rows = [
        row
        for row in response.data
        if row["quantity"] <= row["reorder_level"]
    ]
    # Keep products whose quantity reached or fell below the reorder level.

    return [
        InventoryResponse(
            id=row["id"],
            product_name=row["product_name"],
            sku=row.get("sku"),
            quantity=row["quantity"],
            reorder_level=row["reorder_level"],
            cost_price=float(row["cost_price"]),
            selling_price=float(row["selling_price"]),
            last_sold=row.get("last_sold"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in low_inventory_rows
    ]









# Note: This file saves, reads, and updates inventory items from Supabase.
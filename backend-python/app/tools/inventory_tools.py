# this function of this file is used to check the low inventory items
#  in the inventory store and return the count and the list of low inventory items in json format.

 
from app.services.inventory_store import (
    get_inventory_items,
    get_low_inventory_items,
)

def check_low_inventory() -> dict:
    items = get_low_inventory_items()

    return {
        "count": len(items),
        "items": [
            item.model_dump(mode="json")
            for item in items
        ],
    }
# Note: This tool gets low-inventory products from the store and returns agent-friendly data.

def get_inventory_overview() -> dict:
    items = get_inventory_items()

    return {
        "count": len(items),
        "items": [
            item.model_dump(mode="json")
            for item in items
        ],
    }

def get_inventory_valuation() -> dict:
    items = get_inventory_items()

    total_units = sum(item.quantity for item in items)

    total_cost_value = sum(
        item.quantity * float(item.cost_price)
        for item in items
    )

    total_selling_value = sum(
        item.quantity * float(item.selling_price)
        for item in items
    )

    potential_gross_profit = total_selling_value - total_cost_value

    return {
        "product_count": len(items),
        "total_units": total_units,
        "total_cost_value": round(total_cost_value, 2),
        "total_selling_value": round(total_selling_value, 2),
        "potential_gross_profit": round(potential_gross_profit, 2),
    }
#Note: This tool calculates the total financial value and potential gross profit of the current inventory.

def get_inventory_analysis() -> dict:
    items = get_inventory_items()
    # Read all inventory products from Supabase once.

    all_items = [
        item.model_dump(mode="json")
        for item in items
    ]

    low_items = [
        item.model_dump(mode="json")
        for item in items
        if item.quantity <= item.reorder_level
    ]

    total_units = sum(item.quantity for item in items)

    total_cost_value = sum(
        item.quantity * float(item.cost_price)
        for item in items
    )

    total_selling_value = sum(
        item.quantity * float(item.selling_price)
        for item in items
    )

    return {
        "overview": {
            "count": len(items),
            "items": all_items,
        },
        "low_inventory": {
            "count": len(low_items),
            "items": low_items,
        },
        "valuation": {
            "total_units": total_units,
            "total_cost_value": round(total_cost_value, 2),
            "total_selling_value": round(total_selling_value, 2),
            "potential_gross_profit": round(
                total_selling_value - total_cost_value,
                2,
            ),
        },
    }
# Note: This tool reads inventory once and returns the overview, low-stock products, and financial valuation together.








# Note: This tool returns all inventory products in an agent-friendly format.
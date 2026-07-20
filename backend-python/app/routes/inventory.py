from fastapi import APIRouter, Depends, HTTPException

from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.schemas.inventory_schema import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate,
)
from app.services.inventory_store import (
    create_inventory_item,
    get_inventory_items,
    update_inventory_item,
    delete_inventory_item,
)
router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.post("", response_model=InventoryResponse)
def add_inventory_item(
    item: InventoryCreate,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    new_item = create_inventory_item(item)

    return new_item
    # Create a new inventory item and return it.


@router.get("", response_model=list[InventoryResponse])
def list_inventory_items(
    _: RequestContext = Depends(require_permission("financial.read")),
):
    items = get_inventory_items()

    return items
    # Get all inventory items from Supabase.

@router.patch("/{item_id}", response_model=InventoryResponse)
def edit_inventory_item(
    item_id: str,
    item: InventoryUpdate,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        updated_item = update_inventory_item(
            item_id=item_id,
            item=item,
        )

        return updated_item
        # Update one inventory item and return it.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Inventory item not found",
        )
        # Return 404 if the inventory item ID does not exist.

@router.delete("/{item_id}")
def remove_inventory_item(
    item_id: str,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        delete_inventory_item(item_id)

        return {
            "message": "Inventory item deleted successfully",
            "item_id": item_id,
        }
        # Delete one inventory item and return a success message.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Inventory item not found",
        )
        # Return 404 if the inventory item ID does not exist.




# Note: This route file handles inventory API requests.

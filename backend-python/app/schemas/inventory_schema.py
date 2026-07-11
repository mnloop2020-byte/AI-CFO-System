from pydantic import BaseModel


class InventoryCreate(BaseModel):
    product_name: str
    sku: str | None = None
    quantity: int = 0
    reorder_level: int = 5
    cost_price: float = 0
    selling_price: float = 0


class InventoryResponse(BaseModel):
    id: str
    product_name: str
    sku: str | None = None
    quantity: int
    reorder_level: int
    cost_price: float
    selling_price: float
    last_sold: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

class InventoryUpdate(BaseModel):
    product_name: str | None = None
    sku: str | None = None
    quantity: int | None = None
    reorder_level: int | None = None
    cost_price: float | None = None
    selling_price: float | None = None




# Note: This file defines the inventory request and response data shapes.
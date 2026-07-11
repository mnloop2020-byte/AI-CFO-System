from pydantic import BaseModel


class SaleCreate(BaseModel):
    customer_id: str | None = None
    product_name: str
    quantity: int
    unit_price: float
    status: str = "completed"


class SaleResponse(BaseModel):
    id: str
    customer_id: str | None = None
    product_name: str
    quantity: int
    unit_price: float
    total_amount: float
    status: str
    sale_date: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

class SaleUpdate(BaseModel):
    customer_id: str | None = None
    product_name: str | None = None
    quantity: int | None = None
    unit_price: float | None = None
    status: str | None = None



# Note: This file defines the sale request and response data shapes.
from fastapi import APIRouter , HTTPException

from app.schemas.sales_schema import SaleCreate, SaleResponse, SaleUpdate  
from app.services.sales_store import create_sale, get_sales , update_sale , delete_sale

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post("", response_model=SaleResponse)
def add_sale(sale: SaleCreate):
    new_sale = create_sale(sale)

    return new_sale
    # Create a new sale and return it.


@router.get("", response_model=list[SaleResponse])
def list_sales():
    sales = get_sales()

    return sales
    # Get all sales from Supabase.

@router.patch("/{sale_id}", response_model=SaleResponse)
def edit_sale(sale_id: str, sale: SaleUpdate):
    try:
        updated_sale = update_sale(
            sale_id=sale_id,
            sale=sale,
        )

        return updated_sale
        # Update one sale and return it.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Sale not found",
        )
        # Return 404 if the sale ID does not exist.

@router.delete("/{sale_id}")
def remove_sale(sale_id: str):
    try:
        delete_sale(sale_id)

        return {
            "message": "Sale deleted successfully",
            "sale_id": sale_id,
        }
        # Delete one sale and return a success message.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Sale not found",
        )
        # Return 404 if the sale ID does not exist.

# Note: This route file handles sales API requests.
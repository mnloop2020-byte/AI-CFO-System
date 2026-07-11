from fastapi import APIRouter , HTTPException
# HTTPException = شكل الخطأ الذي سنرجعه للمستخدم

from app.schemas.customer_schema import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer_store import (
    create_customer,
    get_customers,
    update_customer,
    delete_customer,
)

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("", response_model=CustomerResponse)
def add_customer(customer: CustomerCreate):
    new_customer = create_customer(customer)

    return new_customer
    # Create a new customer and return it.


@router.get("", response_model=list[CustomerResponse])
def list_customers():
    customers = get_customers()

    return customers
    # Get all customers from Supabase.


@router.patch("/{customer_id}", response_model=CustomerResponse)
def edit_customer(customer_id: str, customer: CustomerUpdate):
    try:
        updated_customer = update_customer(
            customer_id=customer_id,
            customer=customer,
        )

        return updated_customer
        # Update one customer and return it.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )
        # Return 404 if the customer ID does not exist.
@router.delete("/{customer_id}")
def remove_customer(customer_id: str):
    try:
        delete_customer(customer_id)

        return {
            "message": "Customer deleted successfully",
            "customer_id": customer_id,
        }
        # Delete one customer and return a success message.

    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )
        # Return 404 if the customer ID does not exist.





# Note: This route file handles customer API requests.
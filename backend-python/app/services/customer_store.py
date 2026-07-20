from datetime import datetime, timezone

from app.schemas.customer_schema import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.supabase_client import get_supabase_client


def create_customer(customer: CustomerCreate) -> CustomerResponse:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("customers")
        .insert(customer.model_dump())
        .execute()
    )

    row = response.data[0]

    return CustomerResponse(
        id=row["id"],
        name=row["name"],
        email=row.get("email"),
        phone=row.get("phone"),
        company_name=row.get("company_name"),
        notes=row.get("notes"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Creates a new customer in Supabase and returns it.


def get_customers() -> list[CustomerResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("customers")
        .select("id, name, email, phone, company_name, notes, created_at, updated_at")
        .order("created_at", desc=True)
        .execute()
    )

    return [
        CustomerResponse(
            id=row["id"],
            name=row["name"],
            email=row.get("email"),
            phone=row.get("phone"),
            company_name=row.get("company_name"),
            notes=row.get("notes"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
    # Gets all customers from Supabase.


def update_customer(
    customer_id: str,
    customer: CustomerUpdate,
) -> CustomerResponse:
    supabase = get_supabase_client()

    update_data = customer.model_dump(exclude_none=True)
    # Keep only the fields the user wants to update.

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Update the last modified time.

    response = (
        supabase
        .table("customers")
        .update(update_data)
        .eq("id", customer_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Customer not found")
    # Stop if no customer was found with this ID.

    row = response.data[0]

    return CustomerResponse(
        id=row["id"],
        name=row["name"],
        email=row.get("email"),
        phone=row.get("phone"),
        company_name=row.get("company_name"),
        notes=row.get("notes"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Updates one customer in Supabase and returns the updated customer.

def delete_customer(customer_id: str) -> None:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("customers")
        .delete()
        .eq("id", customer_id)
        .execute()
    )

    if not response.data:
        raise ValueError("Customer not found")
    # Stop if no customer was found with this ID.


# Note: This function deletes one customer from Supabase.



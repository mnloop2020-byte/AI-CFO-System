from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company_name: str | None = None
    notes: str | None = None


class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone: str | None = None
    company_name: str | None = None
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None



class CustomerUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company_name: str | None = None
    notes: str | None = None

# Note: This file defines the customer request and response data shapes.
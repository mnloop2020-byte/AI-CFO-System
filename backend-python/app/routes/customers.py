from fastapi import APIRouter

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/")
def list_customers():
    return {"message": "Customers route placeholder"}

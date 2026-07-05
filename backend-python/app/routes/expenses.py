from fastapi import APIRouter

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/")
def list_expenses():
    return {"message": "Expenses route placeholder"}

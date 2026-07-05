from fastapi import APIRouter

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("/")
def list_invoices():
    return {"message": "Invoices route placeholder"}

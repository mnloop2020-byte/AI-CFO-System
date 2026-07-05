from fastapi import APIRouter

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/")
def list_inventory():
    return {"message": "Inventory route placeholder"}

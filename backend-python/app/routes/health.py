from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/about")
def about():
    return {
        "project": "AI CFO System",
        "backend": "Python FastAPI",
        "version": "1.0",
    }

from fastapi import FastAPI

from app.routes.chat import router as chat_router
from app.routes.health import router as health_router

app = FastAPI(title="AI CFO Python Backend")

app.include_router(health_router)
app.include_router(chat_router)


# Note: This file creates the FastAPI app and connects all route files.
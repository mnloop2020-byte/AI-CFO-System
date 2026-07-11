from fastapi import FastAPI

from app.routes.chat import router as chat_router
from app.routes.customers import router as customers_router
from app.routes.expenses import router as expenses_router
from app.routes.health import router as health_router
from app.routes.rag import router as rag_router
from app.routes.sales import router as sales_router
from app.routes.inventory import router as inventory_router
from app.routes.invoices import router as invoices_router
app = FastAPI(title="AI CFO Python Backend")

app.router.include_router(health_router)
app.router.include_router(chat_router)
app.router.include_router(rag_router)
app.router.include_router(customers_router)
app.router.include_router(sales_router)
app.router.include_router(expenses_router)
app.router.include_router(inventory_router)    
app.router.include_router(invoices_router)
# Note: This file connects all route files to the FastAPI app.
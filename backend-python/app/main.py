from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.actions import router as actions_router
from app.routes.attachments import router as attachments_router
from app.routes.chat import router as chat_router
from app.routes.company import router as company_router
from app.routes.customers import router as customers_router
from app.routes.expenses import router as expenses_router
from app.routes.health import router as health_router
from app.routes.inventory import router as inventory_router
from app.routes.invoices import router as invoices_router
from app.routes.rag import router as rag_router
from app.routes.reports import router as reports_router
from app.routes.sales import router as sales_router
from app.security.authentication import require_authenticated_request


app = FastAPI(title="AI CFO Python Backend")


allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.118:3000",
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Authorization",
        "Content-Type",
    ],
)


app.include_router(health_router)
app.include_router(auth_router)
protected_dependencies = [Depends(require_authenticated_request)]

app.include_router(company_router, dependencies=protected_dependencies)
app.include_router(actions_router, dependencies=protected_dependencies)
app.include_router(attachments_router, dependencies=protected_dependencies)
app.include_router(chat_router, dependencies=protected_dependencies)
app.include_router(rag_router, dependencies=protected_dependencies)
app.include_router(reports_router, dependencies=protected_dependencies)
app.include_router(customers_router, dependencies=protected_dependencies)
app.include_router(sales_router, dependencies=protected_dependencies)
app.include_router(expenses_router, dependencies=protected_dependencies)
app.include_router(inventory_router, dependencies=protected_dependencies)
app.include_router(invoices_router, dependencies=protected_dependencies)


# This file connects all route files to the FastAPI app.

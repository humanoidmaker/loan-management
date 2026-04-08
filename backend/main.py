from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db
from api.auth_routes import router as auth_router
from api.settings_routes import router as settings_router
from api.borrowers import router as borrowers_router
from api.loans import router as loans_router
from api.payments import router as payments_router
from api.emi import router as emi_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="LoanDesk API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(borrowers_router)
app.include_router(loans_router)
app.include_router(payments_router)
app.include_router(emi_router)


@app.get("/api/stats")
async def global_stats():
    from database import loans_col, borrowers_col, payments_col, emi_schedule_col
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    loans_count = await loans_col.count_documents({"status": "active"})
    borrowers_count = await borrowers_col.count_documents({"is_active": True})
    overdue = await emi_schedule_col.count_documents({"status": "unpaid", "due_date": {"$lt": now}})

    return {
        "active_loans": loans_count,
        "active_borrowers": borrowers_count,
        "overdue_emis": overdue,
    }


# Public EMI calculator (no auth)
from api.loans import router as loans_router_public
# The /api/loans/calculate-emi endpoint is already public in the loans router


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

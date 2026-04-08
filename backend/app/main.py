from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
from app.api import auth, borrowers, loans, payments, settings as settings_api

@asynccontextmanager
async def lifespan(app):
    await init_db()
    yield

app = FastAPI(title="LoanDesk API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(borrowers.router)
app.include_router(loans.router)
app.include_router(payments.router)
app.include_router(settings_api.router)

# Public EMI calculator
@app.post("/api/calculate-emi")
async def public_emi(data: dict):
    from app.api.loans import calc_emi
    p = data.get("principal", 0)
    r = data.get("annual_rate", 12)
    t = data.get("tenure_months", 12)
    emi = calc_emi(p, r, t)
    total = round(emi * t, 2)
    return {"emi": emi, "total_interest": round(total - p, 2), "total_payable": total}

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "LoanDesk"}

@app.get("/api/stats")
async def stats():
    from app.core.database import get_db as gdb
    from datetime import datetime, timezone
    db = await gdb()
    pipe = [{"$match": {"status": "active"}}, {"$group": {"_id": None, "disbursed": {"$sum": "$principal_amount"}, "outstanding": {"$sum": "$outstanding_amount"}, "count": {"$sum": 1}}}]
    r = await db.loans.aggregate(pipe).to_list(1)
    d = r[0] if r else {"disbursed": 0, "outstanding": 0, "count": 0}
    total_borrowers = await db.borrowers.count_documents({"is_active": {"$ne": False}})
    return {"stats": {"total_disbursed": d["disbursed"], "total_outstanding": d["outstanding"], "active_loans": d["count"], "total_borrowers": total_borrowers}}

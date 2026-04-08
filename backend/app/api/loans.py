from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from app.core.database import get_db
from app.utils.auth import get_current_user, require_admin
import random, string, math

router = APIRouter(prefix="/api/loans", tags=["loans"])

def s(doc):
    if doc: doc["id"] = str(doc.pop("_id"))
    return doc

def calc_emi(principal, annual_rate, tenure_months):
    """Standard EMI formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1)"""
    if annual_rate == 0: return round(principal / tenure_months, 2)
    r = annual_rate / 12 / 100
    n = tenure_months
    emi = principal * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)
    return round(emi, 2)

def gen_loan_number():
    now = datetime.now(timezone.utc)
    return f"LN-{now.strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=4))}"

@router.post("/calculate-emi")
async def calculate_emi_public(data: dict):
    """Public EMI calculator — no auth"""
    principal = data.get("principal", 0)
    rate = data.get("annual_rate", 12)
    tenure = data.get("tenure_months", 12)
    emi = calc_emi(principal, rate, tenure)
    total_payable = round(emi * tenure, 2)
    total_interest = round(total_payable - principal, 2)
    return {"success": True, "emi": emi, "total_interest": total_interest, "total_payable": total_payable, "principal": principal, "rate": rate, "tenure": tenure}

@router.post("/")
async def create_loan(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    principal = data["principal_amount"]
    rate = data.get("interest_rate_annual", 12)
    tenure = data.get("tenure_months", 12)
    emi = calc_emi(principal, rate, tenure)
    total_payable = round(emi * tenure, 2)
    total_interest = round(total_payable - principal, 2)
    processing_fee = round(principal * 0.01, 2)

    # Generate EMI schedule
    emi_schedule = []
    balance = principal
    monthly_rate = rate / 12 / 100
    now = datetime.now(timezone.utc)
    for i in range(tenure):
        interest_component = round(balance * monthly_rate, 2)
        principal_component = round(emi - interest_component, 2)
        balance = round(balance - principal_component, 2)
        if balance < 0: balance = 0
        due_date = (now + timedelta(days=30 * (i + 1))).strftime("%Y-%m-%d")
        emi_schedule.append({
            "installment_number": i + 1, "due_date": due_date,
            "emi_amount": emi, "principal_component": principal_component,
            "interest_component": interest_component, "balance_after": max(0, balance),
            "status": "unpaid", "paid_date": None, "penalty": 0,
        })

    loan = {
        "loan_number": gen_loan_number(),
        "borrower_id": data["borrower_id"],
        "principal_amount": principal, "interest_rate_annual": rate,
        "tenure_months": tenure, "emi_amount": emi,
        "total_interest": total_interest, "total_payable": total_payable,
        "processing_fee": processing_fee,
        "loan_type": data.get("loan_type", "personal"),
        "purpose": data.get("purpose", ""),
        "collateral_description": data.get("collateral_description", ""),
        "outstanding_amount": principal,
        "status": "pending",
        "emi_schedule": emi_schedule,
        "created_at": now,
    }
    r = await db.loans.insert_one(loan)
    loan["id"] = str(r.inserted_id); del loan["_id"]
    return {"success": True, "loan": loan}

@router.get("/")
async def list_loans(status: str = "", q: str = "", db=Depends(get_db), user=Depends(get_current_user)):
    f = {}
    if status: f["status"] = status
    if q: f["$or"] = [{"loan_number": {"$regex": q, "$options": "i"}}, {"borrower_id": q}]
    docs = await db.loans.find(f).sort("created_at", -1).to_list(500)
    # Attach borrower names
    for d in docs:
        borrower = await db.borrowers.find_one({"_id": ObjectId(d["borrower_id"])}) if d.get("borrower_id") else None
        d["borrower_name"] = borrower.get("name", "Unknown") if borrower else "Unknown"
    return {"success": True, "loans": [s(d) for d in docs]}

@router.get("/{lid}")
async def get_loan(lid: str, db=Depends(get_db), user=Depends(get_current_user)):
    doc = await db.loans.find_one({"_id": ObjectId(lid)})
    if not doc: raise HTTPException(404, "Not found")
    borrower = await db.borrowers.find_one({"_id": ObjectId(doc["borrower_id"])}) if doc.get("borrower_id") else None
    doc["borrower_name"] = borrower.get("name", "Unknown") if borrower else "Unknown"
    payments = await db.payments.find({"loan_id": lid}).sort("created_at", -1).to_list(100)
    return {"success": True, "loan": s(doc), "payments": [s(p) for p in payments]}

@router.put("/{lid}/approve")
async def approve(lid: str, user=Depends(require_admin), db=Depends(get_db)):
    await db.loans.update_one({"_id": ObjectId(lid)}, {"$set": {"status": "active", "disbursement_date": datetime.now(timezone.utc).isoformat()}})
    return {"success": True}

@router.put("/{lid}/reject")
async def reject(lid: str, data: dict, user=Depends(require_admin), db=Depends(get_db)):
    await db.loans.update_one({"_id": ObjectId(lid)}, {"$set": {"status": "rejected", "rejection_reason": data.get("reason", "")}})
    return {"success": True}

@router.get("/stats/overview")
async def stats(db=Depends(get_db), user=Depends(get_current_user)):
    pipe = [{"$match": {"status": "active"}}, {"$group": {"_id": None, "disbursed": {"$sum": "$principal_amount"}, "outstanding": {"$sum": "$outstanding_amount"}, "count": {"$sum": 1}}}]
    r = await db.loans.aggregate(pipe).to_list(1)
    d = r[0] if r else {"disbursed": 0, "outstanding": 0, "count": 0}
    # Count overdue EMIs
    overdue = 0
    active_loans = await db.loans.find({"status": "active"}).to_list(500)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for loan in active_loans:
        for emi in loan.get("emi_schedule", []):
            if emi["status"] == "unpaid" and emi["due_date"] < today:
                overdue += 1
    return {"success": True, "stats": {"total_disbursed": d["disbursed"], "total_outstanding": d["outstanding"], "active_loans": d["count"], "overdue_emis": overdue}}

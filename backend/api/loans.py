import math
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from database import loans_col, borrowers_col, emi_schedule_col, payments_col, settings_col
from auth import get_current_user

router = APIRouter(prefix="/api/loans", tags=["Loans"])


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


def calculate_emi(principal: float, annual_rate: float, tenure_months: int):
    """Standard EMI formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)"""
    if annual_rate == 0:
        return principal / tenure_months, 0, principal
    r = annual_rate / (12 * 100)
    n = tenure_months
    emi = principal * r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)
    total_payable = emi * n
    total_interest = total_payable - principal
    return round(emi, 2), round(total_interest, 2), round(total_payable, 2)


async def generate_emi_schedule(loan_id: str, principal: float, annual_rate: float, tenure_months: int, emi_amount: float, start_date: datetime):
    """Generate the full EMI amortization schedule."""
    r = annual_rate / (12 * 100) if annual_rate > 0 else 0
    balance = principal
    schedule = []
    current_date = start_date

    for i in range(1, tenure_months + 1):
        interest_component = round(balance * r, 2) if r > 0 else 0
        principal_component = round(emi_amount - interest_component, 2)
        if i == tenure_months:
            principal_component = round(balance, 2)
            emi_for_month = principal_component + interest_component
        else:
            emi_for_month = emi_amount

        # Due date is monthly from start
        due_date = start_date + timedelta(days=30 * i)

        schedule.append({
            "loan_id": loan_id,
            "installment_number": i,
            "due_date": due_date,
            "principal_component": principal_component,
            "interest_component": interest_component,
            "emi_amount": round(emi_for_month, 2),
            "balance_after": round(max(balance - principal_component, 0), 2),
            "status": "unpaid",
            "payment_date": None,
            "penalty_amount": 0,
            "created_at": datetime.now(timezone.utc),
        })
        balance -= principal_component

    if schedule:
        await emi_schedule_col.insert_many(schedule)
    return schedule


class LoanCreate(BaseModel):
    borrower_id: str
    principal_amount: float
    interest_rate_annual: float
    tenure_months: int
    loan_type: str = "personal"  # personal/home/vehicle/business/education
    purpose: Optional[str] = ""
    collateral_description: Optional[str] = ""


class EMICalculateRequest(BaseModel):
    principal: float
    rate: float
    tenure: int


@router.post("/calculate-emi")
async def calculate_emi_public(body: EMICalculateRequest):
    """Public EMI calculator - no auth required."""
    emi, total_interest, total_payable = calculate_emi(body.principal, body.rate, body.tenure)

    # Generate amortization preview
    r = body.rate / (12 * 100) if body.rate > 0 else 0
    balance = body.principal
    amortization = []
    for i in range(1, body.tenure + 1):
        interest_component = round(balance * r, 2) if r > 0 else 0
        principal_component = round(emi - interest_component, 2)
        if i == body.tenure:
            principal_component = round(balance, 2)
        balance -= principal_component
        amortization.append({
            "installment": i,
            "principal": principal_component,
            "interest": interest_component,
            "emi": round(principal_component + interest_component, 2),
            "balance": round(max(balance, 0), 2),
        })

    return {
        "emi": emi,
        "total_interest": total_interest,
        "total_payable": total_payable,
        "amortization": amortization,
    }


@router.post("/")
async def create_loan(body: LoanCreate, user=Depends(get_current_user)):
    # Verify borrower
    borrower = await borrowers_col.find_one({"_id": ObjectId(body.borrower_id)})
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")

    # Calculate EMI
    emi, total_interest, total_payable = calculate_emi(
        body.principal_amount, body.interest_rate_annual, body.tenure_months
    )

    # Get processing fee
    pf_setting = await settings_col.find_one({"key": "processing_fee_percent"})
    pf_percent = float(pf_setting["value"]) if pf_setting else 1
    processing_fee = round(body.principal_amount * pf_percent / 100, 2)

    # Generate loan number
    now = datetime.now(timezone.utc)
    count = await loans_col.count_documents({})
    loan_number = f"LN-{now.strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"

    loan = {
        "loan_number": loan_number,
        "borrower_id": body.borrower_id,
        "borrower_name": borrower["name"],
        "principal_amount": body.principal_amount,
        "interest_rate_annual": body.interest_rate_annual,
        "tenure_months": body.tenure_months,
        "loan_type": body.loan_type,
        "purpose": body.purpose,
        "collateral_description": body.collateral_description,
        "emi_amount": emi,
        "total_interest": total_interest,
        "total_payable": total_payable,
        "processing_fee": processing_fee,
        "outstanding_amount": total_payable,
        "paid_amount": 0,
        "status": "pending",
        "disbursement_date": None,
        "rejection_reason": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await loans_col.insert_one(loan)
    loan_id = str(result.inserted_id)
    loan["_id"] = loan_id

    # Generate EMI schedule
    await generate_emi_schedule(
        loan_id, body.principal_amount, body.interest_rate_annual,
        body.tenure_months, emi, now
    )

    return serialize(loan)


@router.get("/")
async def list_loans(
    status: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user=Depends(get_current_user),
):
    query = {}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"loan_number": {"$regex": q, "$options": "i"}},
            {"borrower_name": {"$regex": q, "$options": "i"}},
        ]
    cursor = loans_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = [serialize(doc) async for doc in cursor]
    total = await loans_col.count_documents(query)
    return {"items": items, "total": total}


@router.get("/stats")
async def loan_stats(user=Depends(get_current_user)):
    pipeline_disbursed = [
        {"$match": {"status": {"$in": ["active", "closed"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$principal_amount"}}},
    ]
    pipeline_outstanding = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$outstanding_amount"}}},
    ]

    disbursed = await loans_col.aggregate(pipeline_disbursed).to_list(1)
    outstanding = await loans_col.aggregate(pipeline_outstanding).to_list(1)
    active_count = await loans_col.count_documents({"status": "active"})
    defaulted_count = await loans_col.count_documents({"status": "defaulted"})

    # Overdue EMIs
    now = datetime.now(timezone.utc)
    overdue_count = await emi_schedule_col.count_documents({
        "status": "unpaid", "due_date": {"$lt": now}
    })

    # NPA: loans where EMIs are overdue > 90 days
    npa_date = now - timedelta(days=90)
    npa_pipeline = [
        {"$match": {"status": "unpaid", "due_date": {"$lt": npa_date}}},
        {"$group": {"_id": "$loan_id"}},
    ]
    npa_loans = await emi_schedule_col.aggregate(npa_pipeline).to_list(None)
    npa_loan_ids = [n["_id"] for n in npa_loans]
    npa_amount = 0
    if npa_loan_ids:
        npa_pipeline2 = [
            {"$match": {"_id": {"$in": [ObjectId(lid) for lid in npa_loan_ids]}}},
            {"$group": {"_id": None, "total": {"$sum": "$outstanding_amount"}}},
        ]
        npa_result = await loans_col.aggregate(npa_pipeline2).to_list(1)
        npa_amount = npa_result[0]["total"] if npa_result else 0

    return {
        "total_disbursed": disbursed[0]["total"] if disbursed else 0,
        "total_outstanding": outstanding[0]["total"] if outstanding else 0,
        "active_loans": active_count,
        "overdue_emis": overdue_count,
        "npa_amount": npa_amount,
        "defaulted_loans": defaulted_count,
    }


@router.get("/overdue")
async def overdue_loans(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    cursor = emi_schedule_col.find({"status": "unpaid", "due_date": {"$lt": now}}).sort("due_date", 1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        # Get loan info
        loan = await loans_col.find_one({"_id": ObjectId(doc["loan_id"])}) if ObjectId.is_valid(doc.get("loan_id", "")) else None
        doc["loan_number"] = loan["loan_number"] if loan else "N/A"
        doc["borrower_name"] = loan["borrower_name"] if loan else "N/A"
        doc["days_overdue"] = (now - doc["due_date"]).days
        items.append(doc)
    return items


@router.get("/{loan_id}")
async def get_loan(loan_id: str, user=Depends(get_current_user)):
    loan = await loans_col.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    loan = serialize(loan)

    # Get EMI schedule
    cursor = emi_schedule_col.find({"loan_id": loan_id}).sort("installment_number", 1)
    loan["emi_schedule"] = [serialize(doc) async for doc in cursor]

    # Mark overdue
    now = datetime.now(timezone.utc)
    for emi in loan["emi_schedule"]:
        if emi["status"] == "unpaid" and emi["due_date"] < now:
            emi["status"] = "overdue"

    # Get payments
    cursor2 = payments_col.find({"loan_id": loan_id}).sort("payment_date", -1)
    loan["payments"] = [serialize(doc) async for doc in cursor2]

    return loan


@router.put("/{loan_id}/approve")
async def approve_loan(loan_id: str, user=Depends(get_current_user)):
    loan = await loans_col.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending loans can be approved")

    now = datetime.now(timezone.utc)
    await loans_col.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": {"status": "active", "disbursement_date": now, "updated_at": now}},
    )
    return {"message": "Loan approved and activated", "disbursement_date": now}


@router.put("/{loan_id}/reject")
async def reject_loan(loan_id: str, reason: str = "Not specified", user=Depends(get_current_user)):
    loan = await loans_col.find_one({"_id": ObjectId(loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending loans can be rejected")

    now = datetime.now(timezone.utc)
    await loans_col.update_one(
        {"_id": ObjectId(loan_id)},
        {"$set": {"status": "rejected", "rejection_reason": reason, "updated_at": now}},
    )
    return {"message": "Loan rejected", "reason": reason}

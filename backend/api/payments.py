from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone
from database import payments_col, loans_col, emi_schedule_col, settings_col
from auth import get_current_user

router = APIRouter(prefix="/api/payments", tags=["Payments"])


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


class PaymentCreate(BaseModel):
    loan_id: str
    amount: float
    payment_method: str = "cash"  # cash/upi/bank_transfer/cheque
    transaction_ref: Optional[str] = ""


@router.post("/")
async def record_payment(body: PaymentCreate, user=Depends(get_current_user)):
    loan = await loans_col.find_one({"_id": ObjectId(body.loan_id)})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] not in ["active", "approved"]:
        raise HTTPException(status_code=400, detail="Loan is not active")

    # Get penalty rate
    penalty_setting = await settings_col.find_one({"key": "late_payment_penalty_percent"})
    penalty_percent = float(penalty_setting["value"]) if penalty_setting else 2

    now = datetime.now(timezone.utc)
    remaining = body.amount
    emis_paid = []

    # Get unpaid EMIs sorted by installment
    cursor = emi_schedule_col.find(
        {"loan_id": body.loan_id, "status": "unpaid"}
    ).sort("installment_number", 1)

    async for emi in cursor:
        if remaining <= 0:
            break

        emi_amount = emi["emi_amount"]
        penalty = 0

        # Check if late
        if emi["due_date"] < now:
            penalty = round(emi_amount * penalty_percent / 100, 2)

        total_due = emi_amount + penalty

        if remaining >= total_due:
            remaining -= total_due
            await emi_schedule_col.update_one(
                {"_id": emi["_id"]},
                {"$set": {
                    "status": "paid",
                    "payment_date": now,
                    "penalty_amount": penalty,
                }},
            )
            emis_paid.append({
                "installment_number": emi["installment_number"],
                "emi_amount": emi_amount,
                "penalty": penalty,
                "total": total_due,
            })
        else:
            break

    if not emis_paid:
        raise HTTPException(status_code=400, detail="Payment amount insufficient for next EMI")

    total_paid = body.amount - remaining
    total_penalty = sum(e["penalty"] for e in emis_paid)

    # Generate receipt number
    count = await payments_col.count_documents({})
    receipt_number = f"RCP-{now.strftime('%Y%m%d')}-{str(count + 1).zfill(4)}"

    payment = {
        "loan_id": body.loan_id,
        "loan_number": loan["loan_number"],
        "borrower_name": loan["borrower_name"],
        "amount": total_paid,
        "penalty_amount": total_penalty,
        "payment_method": body.payment_method,
        "transaction_ref": body.transaction_ref,
        "receipt_number": receipt_number,
        "emis_paid": emis_paid,
        "payment_date": now,
        "created_at": now,
    }

    result = await payments_col.insert_one(payment)
    payment["_id"] = str(result.inserted_id)

    # Update loan outstanding
    new_outstanding = loan["outstanding_amount"] - total_paid
    new_paid = loan.get("paid_amount", 0) + total_paid
    update_data = {
        "outstanding_amount": round(max(new_outstanding, 0), 2),
        "paid_amount": round(new_paid, 2),
        "updated_at": now,
    }

    # Check if all EMIs paid
    unpaid_count = await emi_schedule_col.count_documents({"loan_id": body.loan_id, "status": "unpaid"})
    if unpaid_count == 0:
        update_data["status"] = "closed"

    await loans_col.update_one({"_id": ObjectId(body.loan_id)}, {"$set": update_data})

    return payment


@router.get("/loan/{loan_id}")
async def get_loan_payments(loan_id: str, user=Depends(get_current_user)):
    cursor = payments_col.find({"loan_id": loan_id}).sort("payment_date", -1)
    return [serialize(doc) async for doc in cursor]


@router.get("/stats")
async def payment_stats(user=Depends(get_current_user)):
    pipeline = [
        {"$group": {
            "_id": None,
            "total_collected": {"$sum": "$amount"},
            "total_penalties": {"$sum": "$penalty_amount"},
            "count": {"$sum": 1},
        }},
    ]
    result = await payments_col.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {"total_collected": 0, "total_penalties": 0, "count": 0}
    if "_id" in stats:
        del stats["_id"]

    # Monthly collection for chart
    monthly_pipeline = [
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m", "date": "$payment_date"}},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12},
    ]
    monthly = await payments_col.aggregate(monthly_pipeline).to_list(12)
    stats["monthly"] = [{"month": m["_id"], "total": m["total"], "count": m["count"]} for m in monthly]

    return stats


@router.get("/{payment_id}")
async def get_payment(payment_id: str, user=Depends(get_current_user)):
    doc = await payments_col.find_one({"_id": ObjectId(payment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    return serialize(doc)

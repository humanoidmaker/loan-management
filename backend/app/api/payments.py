from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from app.core.database import get_db
from app.utils.auth import get_current_user
import random, string

router = APIRouter(prefix="/api/payments", tags=["payments"])

def s(doc):
    if doc: doc["id"] = str(doc.pop("_id"))
    return doc

@router.post("/")
async def record_payment(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    loan_id = data["loan_id"]
    amount = data["amount"]
    loan = await db.loans.find_one({"_id": ObjectId(loan_id)})
    if not loan: raise HTTPException(404, "Loan not found")

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    # Find next unpaid EMI and mark as paid
    emi_schedule = loan.get("emi_schedule", [])
    remaining_amount = amount
    emis_paid = 0
    penalty_total = 0

    for emi in emi_schedule:
        if emi["status"] == "unpaid" and remaining_amount >= emi["emi_amount"]:
            emi["status"] = "paid"
            emi["paid_date"] = today
            # Check if late
            if today > emi["due_date"]:
                overdue_days = (datetime.strptime(today, "%Y-%m-%d") - datetime.strptime(emi["due_date"], "%Y-%m-%d")).days
                penalty = round(emi["emi_amount"] * 0.02 * overdue_days / 30, 2)
                emi["penalty"] = penalty
                penalty_total += penalty
            remaining_amount -= emi["emi_amount"]
            emis_paid += 1

    # Update loan
    new_outstanding = max(0, loan["outstanding_amount"] - (amount - penalty_total))
    update = {"emi_schedule": emi_schedule, "outstanding_amount": round(new_outstanding, 2)}
    if new_outstanding <= 0:
        update["status"] = "closed"
    await db.loans.update_one({"_id": ObjectId(loan_id)}, {"$set": update})

    # Record payment
    receipt = f"RCP-{now.strftime('%Y%m%d')}-{''.join(random.choices(string.digits, k=4))}"
    payment = {
        "loan_id": loan_id, "loan_number": loan["loan_number"],
        "amount": amount, "penalty": penalty_total,
        "payment_method": data.get("payment_method", "cash"),
        "transaction_ref": data.get("transaction_ref", ""),
        "receipt_number": receipt,
        "emis_covered": emis_paid,
        "created_at": now,
    }
    r = await db.payments.insert_one(payment)
    payment["id"] = str(r.inserted_id); del payment["_id"]
    return {"success": True, "payment": payment, "emis_paid": emis_paid, "penalty": penalty_total, "new_outstanding": round(new_outstanding, 2)}

@router.get("/loan/{loan_id}")
async def loan_payments(loan_id: str, db=Depends(get_db), user=Depends(get_current_user)):
    docs = await db.payments.find({"loan_id": loan_id}).sort("created_at", -1).to_list(500)
    return {"success": True, "payments": [s(d) for d in docs]}

@router.get("/{pid}")
async def get_payment(pid: str, db=Depends(get_db), user=Depends(get_current_user)):
    doc = await db.payments.find_one({"_id": ObjectId(pid)})
    if not doc: raise HTTPException(404, "Not found")
    return {"success": True, "payment": s(doc)}

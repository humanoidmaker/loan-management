from fastapi import APIRouter, Depends
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from database import emi_schedule_col, loans_col
from auth import get_current_user

router = APIRouter(prefix="/api/emi", tags=["EMI"])


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/loan/{loan_id}")
async def get_loan_emi_schedule(loan_id: str, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    cursor = emi_schedule_col.find({"loan_id": loan_id}).sort("installment_number", 1)
    items = []
    async for doc in cursor:
        doc = serialize(doc)
        if doc["status"] == "unpaid" and doc["due_date"] < now:
            doc["status"] = "overdue"
            doc["days_overdue"] = (now - doc["due_date"]).days
        items.append(doc)
    return items


@router.get("/due-today")
async def emis_due_today(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    cursor = emi_schedule_col.find({
        "status": "unpaid",
        "due_date": {"$gte": start, "$lt": end},
    }).sort("due_date", 1)
    items = []
    async for doc in cursor:
        doc = serialize(doc)
        loan = await loans_col.find_one({"_id": ObjectId(doc["loan_id"])}) if ObjectId.is_valid(doc.get("loan_id", "")) else None
        doc["loan_number"] = loan["loan_number"] if loan else "N/A"
        doc["borrower_name"] = loan["borrower_name"] if loan else "N/A"
        items.append(doc)
    return items


@router.get("/overdue")
async def overdue_emis(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    cursor = emi_schedule_col.find({
        "status": "unpaid",
        "due_date": {"$lt": now},
    }).sort("due_date", 1)
    items = []
    async for doc in cursor:
        doc = serialize(doc)
        loan = await loans_col.find_one({"_id": ObjectId(doc["loan_id"])}) if ObjectId.is_valid(doc.get("loan_id", "")) else None
        doc["loan_number"] = loan["loan_number"] if loan else "N/A"
        doc["borrower_name"] = loan["borrower_name"] if loan else "N/A"
        doc["days_overdue"] = (now - doc["due_date"]).days
        items.append(doc)
    return items

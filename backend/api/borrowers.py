from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from database import borrowers_col, loans_col
from auth import get_current_user

router = APIRouter(prefix="/api/borrowers", tags=["Borrowers"])


def serialize(doc):
    doc["_id"] = str(doc["_id"])
    return doc


class BorrowerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = ""
    address: Optional[str] = ""
    id_type: str = "aadhaar"  # aadhaar / pan
    id_number: str = ""
    occupation: Optional[str] = ""
    monthly_income: float = 0
    credit_score: Optional[int] = 0
    is_active: bool = True


class BorrowerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    occupation: Optional[str] = None
    monthly_income: Optional[float] = None
    credit_score: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_borrowers(
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    user=Depends(get_current_user),
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if is_active is not None:
        query["is_active"] = is_active
    cursor = borrowers_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = [serialize(doc) async for doc in cursor]
    total = await borrowers_col.count_documents(query)
    return {"items": items, "total": total}


@router.get("/search")
async def search_borrowers(q: str = "", user=Depends(get_current_user)):
    query = {"$or": [
        {"name": {"$regex": q, "$options": "i"}},
        {"phone": {"$regex": q, "$options": "i"}},
    ]} if q else {}
    cursor = borrowers_col.find(query).limit(20)
    return [serialize(doc) async for doc in cursor]


@router.get("/{borrower_id}")
async def get_borrower(borrower_id: str, user=Depends(get_current_user)):
    doc = await borrowers_col.find_one({"_id": ObjectId(borrower_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return serialize(doc)


@router.get("/{borrower_id}/loans")
async def get_borrower_loans(borrower_id: str, user=Depends(get_current_user)):
    cursor = loans_col.find({"borrower_id": borrower_id}).sort("created_at", -1)
    return [serialize(doc) async for doc in cursor]


@router.post("/")
async def create_borrower(body: BorrowerCreate, user=Depends(get_current_user)):
    data = body.model_dump()
    data["created_at"] = datetime.now(timezone.utc)
    data["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await borrowers_col.insert_one(data)
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Phone number already exists")
        raise
    data["_id"] = str(result.inserted_id)
    return data


@router.put("/{borrower_id}")
async def update_borrower(borrower_id: str, body: BorrowerUpdate, user=Depends(get_current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    result = await borrowers_col.update_one({"_id": ObjectId(borrower_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Borrower not found")
    doc = await borrowers_col.find_one({"_id": ObjectId(borrower_id)})
    return serialize(doc)


@router.delete("/{borrower_id}")
async def delete_borrower(borrower_id: str, user=Depends(get_current_user)):
    result = await borrowers_col.delete_one({"_id": ObjectId(borrower_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Borrower not found")
    return {"message": "Borrower deleted"}

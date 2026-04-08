from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from app.core.database import get_db
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/borrowers", tags=["borrowers"])

def s(doc):
    if doc: doc["id"] = str(doc.pop("_id"))
    return doc

@router.get("/")
async def list_borrowers(q: str = "", db=Depends(get_db), user=Depends(get_current_user)):
    f = {"is_active": {"$ne": False}}
    if q: f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q}}]
    return {"success": True, "borrowers": [s(d) for d in await db.borrowers.find(f).sort("name", 1).to_list(500)]}

@router.get("/{bid}")
async def get_borrower(bid: str, db=Depends(get_db), user=Depends(get_current_user)):
    doc = await db.borrowers.find_one({"_id": ObjectId(bid)})
    if not doc: raise HTTPException(404, "Not found")
    loans = await db.loans.find({"borrower_id": bid}).sort("created_at", -1).to_list(50)
    return {"success": True, "borrower": s(doc), "loans": [s(l) for l in loans]}

@router.post("/")
async def create(data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.setdefault("is_active", True)
    data["created_at"] = datetime.now(timezone.utc)
    r = await db.borrowers.insert_one(data)
    return {"success": True, "id": str(r.inserted_id)}

@router.put("/{bid}")
async def update(bid: str, data: dict, user=Depends(get_current_user), db=Depends(get_db)):
    data.pop("id", None); data.pop("_id", None)
    await db.borrowers.update_one({"_id": ObjectId(bid)}, {"$set": data})
    return {"success": True}

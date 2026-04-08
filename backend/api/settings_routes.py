from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from database import settings_col
from auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingUpdate(BaseModel):
    value: str


@router.get("/")
async def get_all_settings(user=Depends(get_current_user)):
    cursor = settings_col.find({}, {"_id": 0})
    settings = {}
    async for s in cursor:
        settings[s["key"]] = s["value"]
    return settings


@router.put("/{key}")
async def update_setting(key: str, body: SettingUpdate, user=Depends(get_current_user)):
    result = await settings_col.update_one({"key": key}, {"$set": {"value": body.value}}, upsert=True)
    return {"message": "Setting updated", "key": key, "value": body.value}

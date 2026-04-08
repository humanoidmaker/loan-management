from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import users_col
from auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(req: LoginRequest):
    user = await users_col.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user["email"], "role": user.get("role", "admin")})
    return {
        "token": token,
        "user": {
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "admin"),
        },
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {"email": user["email"], "name": user.get("name", ""), "role": user.get("role", "admin")}


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, user=Depends(get_current_user)):
    if not verify_password(req.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    from auth import hash_password
    await users_col.update_one({"email": user["email"]}, {"$set": {"password": hash_password(req.new_password)}})
    return {"message": "Password changed successfully"}

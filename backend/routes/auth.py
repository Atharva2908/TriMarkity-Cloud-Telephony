from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import jwt
from datetime import datetime, timedelta
from config import config
from database import db

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Mock login - in production use proper password hashing"""
    user_collection = db.get_db()["users"]
    
    # For demo purposes
    token = jwt.encode(
        {
            "email": request.email,
            "exp": datetime.utcnow() + timedelta(days=7),
            "iat": datetime.utcnow()
        },
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM
    )
    
    return {"access_token": token, "token_type": "bearer"}

def verify_token(token: str):
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

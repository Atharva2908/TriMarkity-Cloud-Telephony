from fastapi import APIRouter, HTTPException
from models import TelnyxConfig, CallNumber
from database import db
from pydantic import BaseModel

router = APIRouter()

class ConfigUpdateRequest(BaseModel):
    api_key: str
    api_v2_key: str
    webhook_url: str

# ✅ FIXED: Kept as /config (becomes /api/admin/config)
@router.get("/config")
async def get_config():
    """Get Telnyx configuration"""
    config_collection = db.get_db()["telnyx_config"]
    config = config_collection.find_one({"key": "main"})
    if not config:
        return {"message": "No configuration found"}
    config.pop("_id", None)
    return config

# ✅ FIXED: Kept as /config (becomes /api/admin/config)
@router.put("/config")
async def update_config(config_update: ConfigUpdateRequest):
    """Update Telnyx configuration"""
    config_collection = db.get_db()["telnyx_config"]
    config_collection.update_one(
        {"key": "main"},
        {"$set": config_update.dict()},
        upsert=True
    )
    return {"message": "Configuration updated"}

# ✅ FIXED: Kept as /numbers (becomes /api/admin/numbers)
@router.get("/numbers")
async def get_call_numbers():
    """Get all configured call numbers"""
    numbers_collection = db.get_db()["call_numbers"]
    numbers = list(numbers_collection.find({}, {"_id": 0}))
    return {"numbers": numbers}

# ✅ FIXED: Kept as /numbers (becomes /api/admin/numbers)
@router.post("/numbers")
async def add_call_number(number: CallNumber):
    """Add a new call number"""
    numbers_collection = db.get_db()["call_numbers"]
    result = numbers_collection.insert_one(number.dict())
    return {"id": str(result.inserted_id), "message": "Number added"}

# ✅ FIXED: Kept as /numbers/{number} (becomes /api/admin/numbers/{number})
@router.delete("/numbers/{number}")
async def delete_call_number(number: str):
    """Delete a call number"""
    numbers_collection = db.get_db()["call_numbers"]
    result = numbers_collection.delete_one({"number": number})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Number not found")
    return {"message": "Number deleted"}

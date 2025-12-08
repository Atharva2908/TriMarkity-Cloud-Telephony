from fastapi import APIRouter, HTTPException
from models import CallNumber
from database import db
from bson.objectid import ObjectId
from typing import List
from datetime import datetime

router = APIRouter()

# ✅ FIXED - Changed back to "/"
@router.get("/")
async def get_numbers():
    """Get all virtual numbers"""
    numbers_collection = db.get_db()["call_numbers"]
    docs = list(numbers_collection.find({}))
    for d in docs:
        d["_id"] = str(d["_id"])
    return {"numbers": docs}

# ✅ FIXED - Changed back to "/"
@router.post("/")
async def create_number(number: CallNumber):
    """Purchase/add a new virtual number"""
    numbers_collection = db.get_db()["call_numbers"]

    # Check if number already exists
    existing = numbers_collection.find_one({"number": number.number})
    if existing:
        raise HTTPException(status_code=400, detail="Number already exists")

    result = numbers_collection.insert_one(number.dict())
    return {"id": str(result.inserted_id), "message": "Number added successfully"}

# ✅ FIXED - Changed back to "/search"
@router.get("/search")
async def search_available_numbers(country_code: str = "US", area_code: str = ""):
    """Search for available numbers (mock implementation)"""
    # In production, this would call Telnyx API to search available numbers
    available_numbers = [
        {"number": "+1212555" + str(1000 + i), "city": "New York", "state": "NY", "country": "US"}
        for i in range(10)
    ]
    return {"available_numbers": available_numbers}

# ✅ FIXED - Changed back to "/{number_id}"
@router.put("/{number_id}")
async def update_number(number_id: str, number: CallNumber):
    """Update a number (e.g., change name/status)"""
    numbers_collection = db.get_db()["call_numbers"]
    result = numbers_collection.update_one(
        {"_id": ObjectId(number_id)},
        {"$set": {**number.dict(), "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Number not found")
    return {"message": "Number updated"}

# ✅ FIXED - Changed back to "/{number_id}"
@router.delete("/{number_id}")
async def delete_number(number_id: str):
    """Delete/remove a virtual number"""
    numbers_collection = db.get_db()["call_numbers"]
    result = numbers_collection.delete_one({"_id": ObjectId(number_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Number not found")
    return {"message": "Number deleted"}

# ✅ FIXED - Changed back to "/{number_id}/set-default"
@router.post("/{number_id}/set-default")
async def set_default_number(number_id: str):
    """Set a number as default outbound caller ID"""
    numbers_collection = db.get_db()["call_numbers"]

    # Remove default from all numbers
    numbers_collection.update_many({}, {"$set": {"is_default": False}})

    # Set this number as default
    result = numbers_collection.update_one(
        {"_id": ObjectId(number_id)},
        {"$set": {"is_default": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Number not found")
    return {"message": "Default number set"}

# ✅ FIXED - Changed back to "/default"
@router.get("/default")
async def get_default_number():
    """Get the default outbound caller ID"""
    numbers_collection = db.get_db()["call_numbers"]
    default_number = numbers_collection.find_one({"is_default": True})
    if not default_number:
        raise HTTPException(status_code=404, detail="No default number set")
    default_number["_id"] = str(default_number["_id"])
    return default_number

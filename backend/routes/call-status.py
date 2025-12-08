"""
Real-time call status tracking and polling endpoint
"""
from fastapi import APIRouter, HTTPException
from database import db
from datetime import datetime

router = APIRouter()

@router.get("/status/{call_id}")
async def get_call_status(call_id: str):
    """Get current call status for frontend polling"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call["_id"] = str(call["_id"])
    
    # Convert datetime objects to ISO format strings
    for field in ["started_at", "ended_at", "created_at", "updated_at"]:
        if field in call and call[field]:
            call[field] = call[field].isoformat()
    
    return call

@router.get("/active")
async def get_active_calls():
    """Get all currently active calls"""
    calls_collection = db.get_db()["call_logs"]
    active_calls = list(calls_collection.find({
        "status": {"$in": ["dialing", "ringing", "active", "hold"]}
    }).sort("created_at", -1).limit(10))
    
    for call in active_calls:
        call["_id"] = str(call["_id"])
    
    return {"active_calls": active_calls}

@router.get("/recent")
async def get_recent_calls(limit: int = 20):
    """Get recent call logs"""
    calls_collection = db.get_db()["call_logs"]
    calls = list(calls_collection.find({}).sort("created_at", -1).limit(limit))
    
    for call in calls:
        call["_id"] = str(call["_id"])
    
    return {"calls": calls}

@router.get("/stats")
async def get_call_statistics():
    """Get call statistics and metrics"""
    calls_collection = db.get_db()["call_logs"]
    
    total_calls = calls_collection.count_documents({})
    completed_calls = calls_collection.count_documents({"status": "ended"})
    active_calls_count = calls_collection.count_documents({"status": {"$in": ["active", "dialing", "ringing"]}})
    failed_calls = calls_collection.count_documents({"status": "failed"})
    
    all_calls = list(calls_collection.find({}, {"duration": 1}))
    total_duration = sum([call.get("duration", 0) for call in all_calls])
    avg_duration = total_duration // max(completed_calls, 1)
    
    return {
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "active_calls": active_calls_count,
        "failed_calls": failed_calls,
        "total_duration_seconds": total_duration,
        "average_duration": avg_duration
    }

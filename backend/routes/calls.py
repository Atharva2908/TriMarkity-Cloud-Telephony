from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel
from models import CallLog, CallStatus, CallDisposition
from database import db
from datetime import datetime, timedelta
import uuid
from typing import Optional, List

router = APIRouter()

class InitiateCallRequest(BaseModel):
    to_number: str
    from_number: str

class CallStatusUpdate(BaseModel):
    status: CallStatus
    duration: int = 0

class CallLogUpdate(BaseModel):
    disposition: Optional[CallDisposition] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    duration: Optional[int] = None

# ✅ FIXED: Kept as /initiate (becomes /api/calls/initiate)
@router.post("/initiate")
async def initiate_call(request: InitiateCallRequest):
    """Initiate an outbound call"""
    call_id = str(uuid.uuid4())
    
    call_log = CallLog(
        call_id=call_id,
        from_number=request.from_number,
        to_number=request.to_number,
        status=CallStatus.DIALING,
        started_at=datetime.utcnow()
    )
    
    calls_collection = db.get_db()["call_logs"]
    calls_collection.insert_one(call_log.dict())
    
    return {
        "call_id": call_id,
        "status": "dialing",
        "from_number": request.from_number,
        "to_number": request.to_number
    }

# ✅ FIXED: Kept as /logs (becomes /api/calls/logs)
@router.get("/logs")
async def get_call_logs():
    """Get all call logs"""
    calls_collection = db.get_db()["call_logs"]
    logs = list(calls_collection.find({}).sort("created_at", -1).limit(100))
    for log in logs:
        log["_id"] = str(log["_id"])
    return {"logs": logs}

# ✅ IMPORTANT: Moved /logs/search BEFORE /logs/{call_id} to prevent route conflicts
@router.get("/logs/search")
async def search_call_logs(query: str = "", status: str = None):
    """Search call logs by phone number or status"""
    calls_collection = db.get_db()["call_logs"]
    filter_query = {}
    
    if query:
        filter_query["$or"] = [
            {"to_number": {"$regex": query, "$options": "i"}},
            {"from_number": {"$regex": query, "$options": "i"}},
            {"notes": {"$regex": query, "$options": "i"}}
        ]
    
    if status:
        filter_query["status"] = status
    
    logs = list(calls_collection.find(filter_query).sort("created_at", -1).limit(50))
    for log in logs:
        log["_id"] = str(log["_id"])
    return {"logs": logs}

# ✅ FIXED: Kept as /logs/{call_id} (becomes /api/calls/logs/{call_id})
@router.get("/logs/{call_id}")
async def get_call_log(call_id: str):
    """Get a specific call log"""
    calls_collection = db.get_db()["call_logs"]
    log = calls_collection.find_one({"call_id": call_id})
    if not log:
        raise HTTPException(status_code=404, detail="Call log not found")
    log["_id"] = str(log["_id"])
    return log

# ✅ FIXED: Kept as /{call_id}/status (becomes /api/calls/{call_id}/status)
@router.post("/{call_id}/status")
async def update_call_status(call_id: str, update: CallStatusUpdate):
    """Update call status"""
    calls_collection = db.get_db()["call_logs"]
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"status": update.status, "duration": update.duration, "ended_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call status updated"}

# ✅ FIXED: Kept as /{call_id}/log (becomes /api/calls/{call_id}/log)
@router.put("/{call_id}/log")
async def update_call_log(call_id: str, update: CallLogUpdate):
    """Update call log with disposition, notes, and tags"""
    calls_collection = db.get_db()["call_logs"]
    
    update_data = {}
    if update.disposition:
        update_data["disposition"] = update.disposition
    if update.notes:
        update_data["notes"] = update.notes
    if update.tags:
        update_data["tags"] = update.tags
    if update.duration is not None:
        update_data["duration"] = update.duration
    
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {"message": "Call log updated"}

# ✅ FIXED: Kept as /{call_id}/hang-up (becomes /api/calls/{call_id}/hang-up)
@router.post("/{call_id}/hang-up")
async def hang_up_call(call_id: str):
    """End a call"""
    calls_collection = db.get_db()["call_logs"]
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"status": CallStatus.ENDED, "ended_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call ended"}

# ✅ FIXED: Kept as /{call_id}/mute (becomes /api/calls/{call_id}/mute)
@router.post("/{call_id}/mute")
async def mute_call(call_id: str, mute: dict):
    """Mute/unmute a call"""
    calls_collection = db.get_db()["call_logs"]
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"is_muted": mute.get("mute", False)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call muted" if mute.get("mute") else "Call unmuted"}

# ✅ FIXED: Kept as /{call_id}/hold (becomes /api/calls/{call_id}/hold)
@router.post("/{call_id}/hold")
async def hold_call(call_id: str, hold: dict):
    """Put a call on hold"""
    calls_collection = db.get_db()["call_logs"]
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"status": "hold" if hold.get("hold") else "active"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "Call on hold" if hold.get("hold") else "Call resumed"}

# ✅ FIXED: Kept as /{call_id}/dtmf (becomes /api/calls/{call_id}/dtmf)
@router.post("/{call_id}/dtmf")
async def send_dtmf(call_id: str, dtmf: dict):
    """Send DTMF tone during call"""
    calls_collection = db.get_db()["call_logs"]
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$push": {"dtmf_history": {"digit": dtmf.get("digit"), "timestamp": datetime.utcnow()}}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"message": "DTMF sent"}

# ✅ FIXED: Kept as /stats/summary (becomes /api/calls/stats/summary)
@router.get("/stats/summary")
async def get_call_stats():
    """Get call statistics"""
    calls_collection = db.get_db()["call_logs"]
    
    total_calls = calls_collection.count_documents({})
    completed_calls = calls_collection.count_documents({"status": "ended"})
    failed_calls = calls_collection.count_documents({"status": "failed"})
    
    total_duration = sum([call.get("duration", 0) for call in calls_collection.find({}, {"duration": 1})])
    
    return {
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "failed_calls": failed_calls,
        "total_duration_seconds": total_duration,
        "average_duration": total_duration // max(completed_calls, 1)
    }

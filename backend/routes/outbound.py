from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import CallLog, CallStatus
from database import db
from datetime import datetime, timedelta
import uuid
import asyncio

router = APIRouter()

class OutboundCallRequest(BaseModel):
    to_number: str
    from_number: str
    tts_message: str = None
    auto_reconnect: bool = True
    auto_hangup_duration: int = 60

class CallRecordingRequest(BaseModel):
    duration: int
    url: str
    size: int

# Track active calls for reconnect and hangup logic
active_calls = {}

@router.post("/outbound/initiate")
async def initiate_outbound_call(request: OutboundCallRequest):
    """Initiate an outbound call with optional TTS, auto-reconnect, and auto-hangup"""
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
    
    # Store call metadata for lifecycle management
    active_calls[call_id] = {
        "to_number": request.to_number,
        "from_number": request.from_number,
        "tts_message": request.tts_message,
        "auto_reconnect": request.auto_reconnect,
        "auto_hangup_duration": request.auto_hangup_duration,
        "created_at": datetime.utcnow(),
        "reconnect_attempts": 0,
        "max_reconnect_attempts": 3,
    }
    
    # Schedule auto-hangup
    if request.auto_hangup_duration:
        asyncio.create_task(_auto_hangup(call_id, request.auto_hangup_duration))
    
    return {
        "call_id": call_id,
        "status": "initiating",
        "from_number": request.from_number,
        "to_number": request.to_number,
        "message": f"Outbound call initiated. TTS: {request.tts_message or 'None'}"
    }

@router.post("/{call_id}/hangup")
async def hangup_outbound_call(call_id: str):
    """End an outbound call"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    duration = 0
    if call.get("started_at"):
        duration = int((datetime.utcnow() - call["started_at"]).total_seconds())
    
    calls_collection.update_one(
        {"call_id": call_id},
        {
            "$set": {
                "status": CallStatus.ENDED,
                "duration": duration,
                "ended_at": datetime.utcnow()
            }
        }
    )
    
    # Clean up call tracking
    if call_id in active_calls:
        del active_calls[call_id]
    
    return {
        "call_id": call_id,
        "status": "ended",
        "duration": duration
    }

@router.post("/{call_id}/recording/start")
async def start_recording(call_id: str):
    """Start recording a call"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # TODO: Integrate with Telnyx Recording API
    # recording_id = telnyx_client.start_recording(call_id)
    
    return {
        "call_id": call_id,
        "recording_started": True,
        "message": "Recording started - integrate with Telnyx API"
    }

@router.post("/{call_id}/recording/stop")
async def stop_recording(call_id: str):
    """Stop recording a call"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # TODO: Integrate with Telnyx Recording API
    # recording = telnyx_client.stop_recording(call_id)
    
    return {
        "call_id": call_id,
        "recording_stopped": True,
        "message": "Recording stopped - integrate with Telnyx API"
    }

@router.get("/recordings/list")
async def list_recordings():
    """List all call recordings"""
    db_instance = db.get_db()
    recordings_collection = db_instance["recordings"]
    
    recordings = list(recordings_collection.find({}).sort("created_at", -1).limit(100))
    for rec in recordings:
        rec["_id"] = str(rec["_id"])
    
    return {"recordings": recordings}

@router.get("/recordings/{call_id}")
async def get_recording(call_id: str):
    """Get recording metadata for a specific call"""
    db_instance = db.get_db()
    recordings_collection = db_instance["recordings"]
    
    recording = recordings_collection.find_one({"call_id": call_id})
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    recording["_id"] = str(recording["_id"])
    return recording

@router.delete("/recordings/{call_id}/delete")
async def delete_recording(call_id: str):
    """Delete a recording"""
    db_instance = db.get_db()
    recordings_collection = db_instance["recordings"]
    
    result = recordings_collection.delete_one({"call_id": call_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return {"message": "Recording deleted", "call_id": call_id}

async def _auto_hangup(call_id: str, duration: int):
    """Automatically hangup a call after specified duration"""
    await asyncio.sleep(duration)
    
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if call and call.get("status") != CallStatus.ENDED:
        calls_collection.update_one(
            {"call_id": call_id},
            {
                "$set": {
                    "status": CallStatus.ENDED,
                    "ended_at": datetime.utcnow()
                }
            }
        )

async def _handle_reconnect(call_id: str):
    """Handle automatic reconnection on call failure"""
    if call_id not in active_calls:
        return
    
    call_info = active_calls[call_id]
    
    if call_info["reconnect_attempts"] < call_info["max_reconnect_attempts"]:
        call_info["reconnect_attempts"] += 1
        
        calls_collection = db.get_db()["call_logs"]
        calls_collection.update_one(
            {"call_id": call_id},
            {
                "$set": {
                    "status": CallStatus.DIALING,
                    "notes": f"Reconnection attempt {call_info['reconnect_attempts']}"
                }
            }
        )
        
        # Wait before retrying
        await asyncio.sleep(5)

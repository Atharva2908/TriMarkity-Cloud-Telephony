from fastapi import APIRouter, HTTPException, UploadFile, File
from models import Recording
from database import db
from bson.objectid import ObjectId
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/")
async def get_recordings():
    """Get all call recordings"""
    recordings_collection = db.get_db()["recordings"]
    recordings = list(recordings_collection.find({}).sort("created_at", -1).limit(100))
    for recording in recordings:
        recording["_id"] = str(recording["_id"])
    return {"recordings": recordings}

@router.get("/{call_id}")
async def get_call_recording(call_id: str):
    """Get recording for a specific call"""
    recordings_collection = db.get_db()["recordings"]
    recording = recordings_collection.find_one({"call_id": call_id})
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    recording["_id"] = str(recording["_id"])
    return recording

@router.post("/{call_id}/upload")
async def upload_recording(call_id: str, file: UploadFile = File(...)):
    """Upload a call recording"""
    try:
        # Validate call exists
        calls_collection = db.get_db()["call_logs"]
        call = calls_collection.find_one({"call_id": call_id})
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Store recording metadata
        recordings_collection = db.get_db()["recordings"]
        recording_data = {
            "call_id": call_id,
            "filename": file.filename,
            "size": 0,  # Would be set from actual file
            "url": f"/api/recordings/download/{call_id}",
            "created_at": datetime.utcnow()
        }
        
        result = recordings_collection.insert_one(recording_data)
        
        # Update call log with recording URL
        calls_collection.update_one(
            {"call_id": call_id},
            {"$set": {"recording_url": recording_data["url"]}}
        )
        
        return {"id": str(result.inserted_id), "message": "Recording uploaded"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{recording_id}")
async def delete_recording(recording_id: str):
    """Delete a recording"""
    recordings_collection = db.get_db()["recordings"]
    result = recordings_collection.delete_one({"_id": ObjectId(recording_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"message": "Recording deleted"}

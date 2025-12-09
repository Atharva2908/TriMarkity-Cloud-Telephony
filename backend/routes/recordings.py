from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import RedirectResponse
from models import Recording
from database import db
from bson.objectid import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ✅ REMOVE prefix here since it's added in main.py
router = APIRouter(tags=["recordings"])

@router.get("/list")
async def get_recordings():
    """Get all call recordings sorted by most recent"""
    try:
        recordings_collection = db.get_db()["recordings"]
        recordings = list(
            recordings_collection.find({})
            .sort("created_at", -1)
            .limit(100)
        )
        
        formatted_recordings = []
        for recording in recordings:
            # Handle datetime conversion safely
            created_at = recording.get("created_at")
            if isinstance(created_at, datetime):
                created_at_iso = created_at.isoformat()
            elif isinstance(created_at, str):
                created_at_iso = created_at
            else:
                created_at_iso = datetime.utcnow().isoformat()
            
            formatted_recordings.append({
                "_id": str(recording["_id"]),
                "call_id": recording.get("call_id", "unknown"),
                "recording_id": recording.get("recording_id", ""),
                "duration": recording.get("duration", 0),
                "url": recording.get("url", ""),
                "size": recording.get("size", 0),
                "created_at": created_at_iso,
                "to_number": recording.get("to_number", "Unknown"),
                "from_number": recording.get("from_number", "Unknown"),
                "status": recording.get("status", "completed"),
                "filename": recording.get("filename", ""),
                "format": recording.get("format", "mp3"),
            })
        
        logger.info(f"📊 Fetched {len(formatted_recordings)} recordings")
        
        return {
            "recordings": formatted_recordings,
            "total": len(formatted_recordings)
        }
    except Exception as e:
        logger.error(f"❌ Error fetching recordings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{call_id}")
async def get_call_recording(call_id: str):
    """Get recording for a specific call"""
    try:
        recordings_collection = db.get_db()["recordings"]
        recording = recordings_collection.find_one({"call_id": call_id})
        
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        # Handle datetime conversion
        created_at = recording.get("created_at")
        if isinstance(created_at, datetime):
            created_at_iso = created_at.isoformat()
        elif isinstance(created_at, str):
            created_at_iso = created_at
        else:
            created_at_iso = datetime.utcnow().isoformat()
        
        return {
            "_id": str(recording["_id"]),
            "call_id": recording.get("call_id"),
            "recording_id": recording.get("recording_id", ""),
            "duration": recording.get("duration", 0),
            "url": recording.get("url", ""),
            "size": recording.get("size", 0),
            "created_at": created_at_iso,
            "to_number": recording.get("to_number", "Unknown"),
            "from_number": recording.get("from_number", "Unknown"),
            "status": recording.get("status", "completed"),
            "filename": recording.get("filename", ""),
            "format": recording.get("format", "mp3"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching recording {call_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{call_id}/delete")
async def delete_recording(call_id: str):
    """Delete a recording by call_id"""
    try:
        recordings_collection = db.get_db()["recordings"]
        
        # Find by call_id first
        recording = recordings_collection.find_one({"call_id": call_id})
        
        if not recording:
            # Try by ObjectId as fallback
            try:
                result = recordings_collection.delete_one({"_id": ObjectId(call_id)})
                if result.deleted_count == 0:
                    raise HTTPException(status_code=404, detail="Recording not found")
            except Exception as e:
                raise HTTPException(status_code=404, detail="Recording not found")
        else:
            result = recordings_collection.delete_one({"call_id": call_id})
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Recording not found")
        
        # Also remove recording reference from call log
        try:
            calls_collection = db.get_db()["call_logs"]
            calls_collection.update_one(
                {"call_id": call_id},
                {
                    "$set": {
                        "recording_url": None,
                        "has_recording": False,
                        "recording_available": False
                    }
                }
            )
        except Exception as e:
            logger.warning(f"⚠️ Could not update call log: {e}")
        
        logger.info(f"🗑️ Deleted recording for call: {call_id}")
        
        # ✅ Broadcast deletion via WebSocket
        from main import get_call_manager
        manager = get_call_manager()
        await manager.broadcast({
            "type": "recording_deleted",
            "call_id": call_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "message": "Recording deleted successfully",
            "call_id": call_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting recording: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{call_id}/upload")
async def upload_recording(call_id: str, file: UploadFile = File(...)):
    """Upload a call recording file"""
    try:
        # Validate call exists
        calls_collection = db.get_db()["call_logs"]
        call = calls_collection.find_one({"call_id": call_id})
        
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # Validate file type
        allowed_extensions = [".mp3", ".wav", ".m4a", ".ogg"]
        file_ext = "." + file.filename.split(".")[-1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Store recording metadata
        recordings_collection = db.get_db()["recordings"]
        recording_data = {
            "call_id": call_id,
            "filename": file.filename,
            "size": file_size,
            "url": f"/api/calls/recordings/download/{call_id}",
            "duration": call.get("duration", 0),
            "to_number": call.get("to_number", "Unknown"),
            "from_number": call.get("from_number", "Unknown"),
            "status": "completed",
            "format": file_ext.replace(".", ""),
            "created_at": datetime.utcnow()
        }
        
        # Insert or update
        result = recordings_collection.update_one(
            {"call_id": call_id},
            {"$set": recording_data},
            upsert=True
        )
        
        # Update call log with recording URL
        calls_collection.update_one(
            {"call_id": call_id},
            {
                "$set": {
                    "recording_url": recording_data["url"],
                    "has_recording": True,
                    "recording_available": True,
                    "recording_size": file_size
                }
            }
        )
        
        logger.info(f"📤 Uploaded recording for call {call_id}: {file.filename} ({file_size} bytes)")
        
        # ✅ Broadcast new recording via WebSocket
        from main import get_call_manager
        manager = get_call_manager()
        await manager.broadcast({
            "type": "recording_added",
            "call_id": call_id,
            "recording": recording_data,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "id": str(result.upserted_id) if result.upserted_id else call_id,
            "message": "Recording uploaded successfully",
            "url": recording_data["url"],
            "size": file_size,
            "format": file_ext.replace(".", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error uploading recording: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/download/{call_id}")
async def download_recording(call_id: str):
    """Download or serve recording file"""
    try:
        recordings_collection = db.get_db()["recordings"]
        recording = recordings_collection.find_one({"call_id": call_id})
        
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        # Check if we have a local file
        file_path = recording.get("file_path")
        if file_path and os.path.exists(file_path):
            logger.info(f"📁 Serving local file for call {call_id}")
            return FileResponse(
                path=file_path,
                media_type="audio/mpeg",
                filename=f"recording-{call_id}.mp3"
            )
        
        # Fallback to external URL (will likely be expired)
        recording_url = recording.get("url", "")
        if recording_url.startswith("http://") or recording_url.startswith("https://"):
            logger.warning(f"⚠️ Redirecting to external URL (may be expired) for call {call_id}")
            return RedirectResponse(url=recording_url)
        
        raise HTTPException(status_code=404, detail="Recording file not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error downloading recording: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_recording_stats():
    """Get recording statistics"""
    try:
        recordings_collection = db.get_db()["recordings"]
        
        # Aggregate stats
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_recordings": {"$sum": 1},
                    "total_size": {"$sum": "$size"},
                    "total_duration": {"$sum": "$duration"},
                    "avg_duration": {"$avg": "$duration"},
                }
            }
        ]
        
        stats = list(recordings_collection.aggregate(pipeline))
        
        if stats:
            return {
                "total_recordings": stats[0].get("total_recordings", 0),
                "total_size_bytes": stats[0].get("total_size", 0),
                "total_duration_seconds": stats[0].get("total_duration", 0),
                "average_duration_seconds": stats[0].get("avg_duration", 0),
            }
        else:
            return {
                "total_recordings": 0,
                "total_size_bytes": 0,
                "total_duration_seconds": 0,
                "average_duration_seconds": 0,
            }
    except Exception as e:
        logger.error(f"❌ Error fetching recording stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

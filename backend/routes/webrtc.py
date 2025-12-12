"""
WebRTC Bridge Module - Conference Recording for Single File Per Call
"""

import os
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from database import db
from pydantic import BaseModel
from typing import List, Optional
import httpx
from datetime import datetime
import logging
import uuid
import base64
import json
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

# Telnyx Configuration
TELNYX_API_KEY = os.getenv("TELNYX_API_KEY")
TELNYX_BASE_URL = os.getenv("TELNYX_BASE_URL", "https://api.telnyx.com/v2")
TELNYX_WEBHOOK_BASE = os.getenv("TELNYX_WEBHOOK_BASE", "http://localhost:8000")
TELNYX_VOICE_CONNECTION_ID = os.getenv("TELNYX_VOICE_CONNECTION_ID")
TELNYX_WEBRTC_CONNECTION_ID = os.getenv("TELNYX_WEBRTC_CONNECTION_ID")

# Validate required environment variables
if not TELNYX_API_KEY:
    raise ValueError("TELNYX_API_KEY environment variable is required")
if not TELNYX_VOICE_CONNECTION_ID:
    raise ValueError("TELNYX_VOICE_CONNECTION_ID environment variable is required")
if not TELNYX_WEBRTC_CONNECTION_ID:
    raise ValueError("TELNYX_WEBRTC_CONNECTION_ID environment variable is required")

# 🎤 Conference tracking for single-file recording
active_conferences = {}  # Track conferences by internal_call_id
active_calls = {}

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"✅ [WebSocket] Connected - Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"❌ [WebSocket] Disconnected - Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
                logger.info(f"📤 Broadcast: {message.get('type')}")
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Pydantic Models
class InitiateCallRequest(BaseModel):
    to_number: str
    from_number: str

class LogUpdate(BaseModel):
    notes: Optional[str] = ""
    disposition: Optional[str] = ""
    tags: Optional[List[str]] = []

# ============================================================================
# API ENDPOINTS FOR CALL LOGS
# ============================================================================

@router.get("/logs")
async def get_call_logs(limit: int = 100, skip: int = 0):
    """Get all call logs with pagination"""
    try:
        calls_collection = db.get_db()["call_logs"]
        
        logs_cursor = calls_collection.find().sort("created_at", -1).skip(skip).limit(limit)
        logs = list(logs_cursor)
        
        for log in logs:
            log["_id"] = str(log["_id"])
            for date_field in ["created_at", "started_at", "answered_at", "ended_at", "recording_saved_at"]:
                if date_field in log and log[date_field]:
                    log[date_field] = log[date_field].isoformat()
        
        total_count = calls_collection.count_documents({})
        
        logger.info(f"📊 Retrieved {len(logs)} call logs (total: {total_count})")
        
        return {
            "logs": logs,
            "total": total_count,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/{log_id}")
async def get_call_log(log_id: str):
    """Get specific call log by ID"""
    try:
        calls_collection = db.get_db()["call_logs"]
        
        log = calls_collection.find_one({"call_id": log_id})
        if not log:
            from bson import ObjectId
            try:
                log = calls_collection.find_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if not log:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        log["_id"] = str(log["_id"])
        for date_field in ["created_at", "started_at", "answered_at", "ended_at", "recording_saved_at"]:
            if date_field in log and log[date_field]:
                log[date_field] = log[date_field].isoformat()
        
        return log
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching log {log_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/logs/{log_id}")
async def update_call_log(log_id: str, update: LogUpdate):
    """Update call log (notes, disposition, tags)"""
    try:
        calls_collection = db.get_db()["call_logs"]
        
        update_doc = {}
        if update.notes is not None:
            update_doc["notes"] = update.notes
        if update.disposition is not None:
            update_doc["disposition"] = update.disposition
        if update.tags is not None:
            update_doc["tags"] = update.tags
        
        update_doc["updated_at"] = datetime.utcnow()
        
        result = calls_collection.update_one(
            {"call_id": log_id},
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            from bson import ObjectId
            try:
                result = calls_collection.update_one(
                    {"_id": ObjectId(log_id)},
                    {"$set": update_doc}
                )
            except:
                pass
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        updated_log = calls_collection.find_one({"call_id": log_id})
        if not updated_log:
            from bson import ObjectId
            try:
                updated_log = calls_collection.find_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if updated_log:
            updated_log["_id"] = str(updated_log["_id"])
            
            await manager.broadcast({
                "type": "log_updated",
                "log": updated_log
            })
        
        logger.info(f"✅ Updated call log: {log_id}")
        return {"success": True, "log": updated_log}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating log {log_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/logs/{log_id}")
async def delete_call_log(log_id: str):
    """Delete call log"""
    try:
        calls_collection = db.get_db()["call_logs"]
        
        result = calls_collection.delete_one({"call_id": log_id})
        
        if result.deleted_count == 0:
            from bson import ObjectId
            try:
                result = calls_collection.delete_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        await manager.broadcast({
            "type": "log_deleted",
            "log_id": log_id
        })
        
        logger.info(f"🗑️ Deleted call log: {log_id}")
        return {"success": True, "deleted_count": result.deleted_count}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting log {log_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# RECORDING ENDPOINTS
# ============================================================================

@router.get("/recordings/list")
async def list_recordings():
    """List all recordings - only valid ones with duration > 0"""
    try:
        recordings_collection = db.get_db()["recordings"]
        
        recordings_cursor = recordings_collection.find({
            "duration": {"$gt": 0},
            "url": {"$ne": None, "$ne": ""}
        }).sort("created_at", -1)
        
        recordings = list(recordings_cursor)
        
        for rec in recordings:
            rec["_id"] = str(rec["_id"])
            if "created_at" in rec and rec["created_at"]:
                rec["created_at"] = rec["created_at"].isoformat()
        
        logger.info(f"📼 Listed {len(recordings)} valid recordings")
        
        return {
            "recordings": recordings,
            "total": len(recordings)
        }
        
    except Exception as e:
        logger.error(f"❌ Error listing recordings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recordings/download/{call_id}")
async def download_recording(call_id: str):
    """Download recording with proper MIME type and CORS headers"""
    try:
        recordings_collection = db.get_db()["recordings"]
        recording = recordings_collection.find_one({"call_id": call_id})
        
        if not recording:
            logger.error(f"❌ Recording not found for call_id: {call_id}")
            raise HTTPException(status_code=404, detail="Recording not found")
        
        recording_url = recording.get("url")
        if not recording_url:
            logger.error(f"❌ Recording URL not available for call_id: {call_id}")
            raise HTTPException(status_code=404, detail="Recording URL not available")
        
        logger.info(f"📥 Fetching recording from Telnyx: {recording_url[:100]}...")
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(recording_url)
            response.raise_for_status()
        
        format_type = recording.get("format", "wav").lower()
        content_type = "audio/wav" if format_type == "wav" else "audio/mpeg"
        
        channels = recording.get("channels", "single")
        is_stereo = str(channels).lower() in ["dual", "2", "stereo"]
        channel_suffix = "-stereo" if is_stereo else "-mono"
        
        filename = f"recording-{call_id}{channel_suffix}.{format_type}"
        
        logger.info(f"✅ Serving recording: {filename} ({content_type})")
        
        return Response(
            content=response.content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cache-Control": "public, max-age=3600",
                "Accept-Ranges": "bytes"
            }
        )
        
    except httpx.HTTPError as e:
        logger.error(f"❌ Error fetching recording from Telnyx: {str(e)}")
        raise HTTPException(status_code=502, detail="Failed to fetch recording from storage")
    except Exception as e:
        logger.error(f"❌ Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/recordings/{call_id}/delete")
async def delete_recording(call_id: str):
    """Delete recording from database"""
    try:
        recordings_collection = db.get_db()["recordings"]
        
        recording = recordings_collection.find_one({"call_id": call_id})
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        result = recordings_collection.delete_one({"call_id": call_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        calls_collection = db.get_db()["call_logs"]
        calls_collection.update_one(
            {"call_id": call_id},
            {"$set": {
                "has_recording": False,
                "recording_url": None,
                "recording_deleted_at": datetime.utcnow()
            }}
        )
        
        await manager.broadcast({
            "type": "recording_deleted",
            "call_id": call_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        logger.info(f"🗑️ Deleted recording: {call_id}")
        
        return {
            "success": True,
            "call_id": call_id,
            "message": "Recording deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete recording error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recordings/cleanup-duplicates")
async def cleanup_duplicate_recordings():
    """Remove empty recordings (0 bytes, 0 duration)"""
    try:
        recordings_collection = db.get_db()["recordings"]
        
        result = recordings_collection.delete_many({
            "$or": [
                {"duration": {"$lte": 0}},
                {"size": {"$lte": 0}},
                {"url": {"$in": [None, ""]}}
            ]
        })
        
        logger.info(f"🧹 Cleaned up {result.deleted_count} empty recordings")
        
        return {
            "success": True,
            "deleted_count": result.deleted_count,
            "message": f"Removed {result.deleted_count} empty recordings"
        }
        
    except Exception as e:
        logger.error(f"❌ Cleanup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WEBSOCKET ENDPOINT
# ============================================================================

@router.websocket("/ws/calls")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time call and recording updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("🔌 Client disconnected from WebSocket")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {str(e)}")
        manager.disconnect(websocket)

# ============================================================================
# CALL CONTROL
# ============================================================================

@router.post("/initiate")
async def initiate_call(request: InitiateCallRequest):
    """Create PSTN call"""
    try:
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        internal_call_id = str(uuid.uuid4())
        
        numbers_collection = db.get_db()["call_numbers"]
        default_number_doc = numbers_collection.find_one({"is_default": True})
        
        if not default_number_doc:
            raise HTTPException(
                status_code=400,
                detail="No default outbound number configured"
            )
        
        from_number = default_number_doc["number"]
        logger.info(f"📞 Using caller ID: {from_number}")
        
        pstn_payload = {
            "connection_id": TELNYX_VOICE_CONNECTION_ID,
            "to": request.to_number,
            "from": from_number,
            "webhook_url": f"{TELNYX_WEBHOOK_BASE}/api/webrtc/webhook/telnyx",
            "client_state": base64.b64encode(json.dumps({
                "internal_call_id": internal_call_id,
                "leg": "outbound"
            }).encode()).decode(),
            "timeout_secs": 60,
            "time_limit_secs": 14400,
            "answering_machine_detection": "disabled",
        }
        
        logger.info(f"📞 Creating OUTBOUND leg: {from_number} → {request.to_number}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            pstn_response = await client.post(
                f"{TELNYX_BASE_URL}/calls",
                headers=headers,
                json=pstn_payload,
            )
        
        if pstn_response.status_code not in (200, 201):
            error_body = pstn_response.text
            logger.error(f"❌ PSTN leg failed: {error_body}")
            raise HTTPException(status_code=400, detail=f"PSTN leg failed: {error_body}")
        
        pstn_data = pstn_response.json().get("data", {})
        pstn_call_control_id = pstn_data.get("call_control_id")
        
        logger.info(f"✅ PSTN leg created: {pstn_call_control_id}")
        
        calls_collection = db.get_db()["call_logs"]
        call_doc = {
            "call_id": internal_call_id,
            "telnyx_call_control_id": pstn_call_control_id,
            "from_number": from_number,
            "to_number": request.to_number,
            "direction": "outbound",
            "status": "dialing",
            "is_recording": False,
            "recording_requested": False,
            "started_at": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "duration": 0,
            "notes": "",
            "tags": [],
        }
        calls_collection.insert_one(call_doc)
        
        call_doc["_id"] = str(call_doc["_id"])
        
        await manager.broadcast({
            "type": "call_initiated",
            "call": call_doc
        })
        
        return {
            "call_id": internal_call_id,
            "status": "dialing",
            "from": from_number,
            "to": request.to_number,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 🎤 CONFERENCE-BASED WEBHOOK (SINGLE FILE RECORDING)
# ============================================================================

@router.post("/webhook/telnyx")
async def telnyx_webhook(request: Request):
    """Handle webhooks - Conference recording for single merged file"""
    global active_conferences
    
    payload = await request.json()
    
    try:
        data = payload.get("data", {})
        event_type = data.get("event_type")
        event_payload = data.get("payload", {})
        
        logger.info(f"📞 Webhook event: {event_type}")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # ===== INBOUND CALL INITIATED =====
        if event_type == "call.initiated":
            client_state_b64 = event_payload.get("client_state", "")
            
            if not client_state_b64:
                call_control_id = event_payload.get("call_control_id")
                from_number = event_payload.get("from")
                to_number = event_payload.get("to")
                
                internal_call_id = str(uuid.uuid4())
                
                logger.info(f"📲 INBOUND call: {from_number} → {to_number}")
                
                calls_collection = db.get_db()["call_logs"]
                call_doc = {
                    "call_id": internal_call_id,
                    "telnyx_call_control_id": call_control_id,
                    "from_number": from_number,
                    "to_number": to_number,
                    "direction": "inbound",
                    "status": "ringing",
                    "is_recording": False,
                    "recording_requested": False,
                    "started_at": datetime.utcnow(),
                    "created_at": datetime.utcnow(),
                    "duration": 0,
                    "notes": "",
                    "tags": [],
                }
                calls_collection.insert_one(call_doc)
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELNYX_BASE_URL}/calls/{call_control_id}/actions/answer",
                        headers=headers,
                        json={
                            "client_state": base64.b64encode(json.dumps({
                                "internal_call_id": internal_call_id,
                                "leg": "inbound"
                            }).encode()).decode()
                        }
                    )
                
                logger.info(f"✅ Inbound call answered: {call_control_id}")
                
                call_doc["_id"] = str(call_doc["_id"])
                await manager.broadcast({
                    "type": "call_initiated",
                    "call": call_doc
                })
                
                return {"status": "ok"}
        
        # ===== CONFERENCE RECORDING SAVED =====
        if event_type == "conference.recording.saved":
            conference_id = event_payload.get("conference_id")
            recording_urls = event_payload.get("recording_urls", {})
            public_recording_urls = event_payload.get("public_recording_urls", {})
            
            logger.info("=" * 80)
            logger.info("📼 CONFERENCE RECORDING SAVED:")
            logger.info(f"   Conference ID: {conference_id}")
            logger.info(f"   Recording ID: {event_payload.get('recording_id', 'N/A')}")
            logger.info(f"   Channels: {event_payload.get('channels', 'N/A')}")
            logger.info(f"   Format: {event_payload.get('format', 'N/A')}")
            logger.info("=" * 80)
            
            recording_url = (
                public_recording_urls.get("wav") or 
                recording_urls.get("wav")
            )
            
            if recording_url:
                calls_collection = db.get_db()["call_logs"]
                call_log = calls_collection.find_one({"conference_id": conference_id})
                
                if call_log:
                    recordings_collection = db.get_db()["recordings"]
                    
                    recording_format = "wav"
                    channels = event_payload.get("channels", "dual")
                    
                    recording_data = {
                        "call_id": call_log["call_id"],
                        "recording_id": event_payload.get("recording_id"),
                        "url": recording_url,
                        "duration": call_log.get("duration", 0),
                        "size": event_payload.get("size", 0),
                        "to_number": call_log.get("to_number", "Unknown"),
                        "from_number": call_log.get("from_number", "Unknown"),
                        "direction": call_log.get("direction", "outbound"),
                        "created_at": datetime.utcnow(),
                        "status": "completed",
                        "format": recording_format,
                        "channels": channels,
                        "recording_type": "conference",
                        "filename": f"recording-{call_log['call_id']}.{recording_format}"
                    }
                    
                    recordings_collection.update_one(
                        {"call_id": call_log["call_id"]},
                        {"$set": recording_data},
                        upsert=True
                    )
                    
                    calls_collection.update_one(
                        {"call_id": call_log["call_id"]},
                        {"$set": {
                            "recording_url": recording_url,
                            "recording_saved_at": datetime.utcnow(),
                            "has_recording": True
                        }}
                    )
                    
                    logger.info(f"💾 ✅ SINGLE conference recording saved: {call_log['call_id']}")
                    
                    await manager.broadcast({
                        "type": "recording_added",
                        "call_id": call_log["call_id"],
                        "recording": recording_data
                    })
            
            return {"status": "ok"}
        
        # ===== Extract client state for other events =====
        client_state_b64 = event_payload.get("client_state", "")
        if not client_state_b64:
            return {"status": "ignored"}
        
        client_state = json.loads(base64.b64decode(client_state_b64).decode())
        internal_call_id = client_state.get("internal_call_id")
        
        if not internal_call_id:
            return {"status": "ignored"}
        
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": internal_call_id})
        
        if not call_doc:
            logger.warning(f"⚠️ Call not found: {internal_call_id}")
            return {"status": "call not found"}
        
        # ===== 🎤 CALL ANSWERED - CREATE OR JOIN CONFERENCE =====
        if event_type == "call.answered":
            call_control_id = event_payload.get("call_control_id")
            direction = client_state.get("leg", "outbound")
            
            logger.info(f"✅ Call answered: {call_control_id} ({direction})")
            
            conference_name = f"conf-{internal_call_id}"
            
            # ✅ FIX: Check if conference exists for THIS internal_call_id
            if internal_call_id not in active_conferences:
                # 🎤 FIRST LEG - CREATE CONFERENCE
                logger.info(f"🎤 Creating NEW conference: {conference_name}")
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    conf_response = await client.post(
                        f"{TELNYX_BASE_URL}/conferences",
                        headers=headers,
                        json={
                            "call_control_id": call_control_id,
                            "name": conference_name,
                            "beep_enabled": "never",
                            "record": "dual-channel",  # ✅ FIX: ENABLE DUAL-CHANNEL
                            "record_format": "wav"
                        }
                    )
                
                if conf_response.status_code == 200:
                    conf_data = conf_response.json().get("data", {})
                    conference_id = conf_data.get("id")
                    
                    # ✅ Store conference info
                    active_conferences[internal_call_id] = {
                        "conference_id": conference_id,
                        "conference_name": conference_name,
                        "participants": [call_control_id],
                        "created_at": datetime.utcnow()
                    }
                    
                    logger.info(f"✅ Conference created: {conference_id}")
                    logger.info(f"   Participant: {call_control_id} ({direction})")
                    
                    # Save conference ID to database
                    calls_collection.update_one(
                        {"call_id": internal_call_id},
                        {"$set": {
                            "status": "active",
                            "answered_at": datetime.utcnow(),
                            "conference_id": conference_id,
                            "recording_type": "conference"
                        }}
                    )
                    
                    # Wait before starting recording
                    await asyncio.sleep(0.5)
                    
                    # ✅ START DUAL-CHANNEL RECORDING
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        record_response = await client.post(
                            f"{TELNYX_BASE_URL}/conferences/{conference_id}/actions/record_start",
                            headers=headers,
                            json={
                                "format": "wav",
                                "channels": "dual"  # ✅ FIX: DUAL CHANNEL
                            }
                        )
                    
                    if record_response.status_code == 200:
                        logger.info("🔴 Conference recording started (DUAL-CHANNEL)")
                        
                        calls_collection.update_one(
                            {"call_id": internal_call_id},
                            {"$set": {
                                "is_recording": True,
                                "recording_requested": True,
                                "recording_started_at": datetime.utcnow()
                            }}
                        )
                        
                        await manager.broadcast({
                            "type": "recording_started",
                            "call_id": internal_call_id,
                            "recording_type": "conference",
                            "channels": "dual"
                        })
                else:
                    logger.error(f"❌ Failed to create conference: {conf_response.text}")
            
            else:
                # 🔗 SECOND LEG - JOIN EXISTING CONFERENCE
                conference_info = active_conferences[internal_call_id]
                conference_id = conference_info["conference_id"]
                
                logger.info(f"🔗 Joining EXISTING conference: {conference_id}")
                logger.info(f"   New participant: {call_control_id} ({direction})")
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    join_response = await client.post(
                        f"{TELNYX_BASE_URL}/calls/{call_control_id}/actions/join",
                        headers=headers,
                        json={
                            "conference_name": conference_name,
                            "call_control_id": call_control_id
                        }
                    )
                
                if join_response.status_code == 200:
                    active_conferences[internal_call_id]["participants"].append(call_control_id)
                    logger.info(f"✅ {direction.upper()} leg joined conference")
                    logger.info(f"   Total participants: {len(active_conferences[internal_call_id]['participants'])}")
                else:
                    logger.error(f"❌ Failed to join conference: {join_response.text}")
            
            # Broadcast call answered
            updated_call = calls_collection.find_one({"call_id": internal_call_id})
            if updated_call:
                updated_call["_id"] = str(updated_call["_id"])
                await manager.broadcast({
                    "type": "call_answered",
                    "call": updated_call
                })
        
        # ===== CALL HANGUP =====
        elif event_type in ["call.hangup", "call.ended"]:
            hangup_cause = event_payload.get("hangup_cause", "normal")
            hangup_source = event_payload.get("hangup_source", "unknown")
            sip_code = event_payload.get("sip_code", "unknown")
            
            started_at = call_doc.get("answered_at") or call_doc.get("started_at")
            duration = 0
            if started_at:
                duration = int((datetime.utcnow() - started_at).total_seconds())
            
            disposition = "completed"
            if hangup_cause == "USER_BUSY":
                disposition = "busy"
            elif hangup_cause == "NO_ANSWER":
                disposition = "no_answer"
            elif hangup_cause not in ["NORMAL_CLEARING", "normal"]:
                disposition = "failed"
            
            logger.info(f"📴 Call ended: {internal_call_id}, duration: {duration}s")
            
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {
                    "status": "ended",
                    "ended_at": datetime.utcnow(),
                    "duration": duration,
                    "hangup_cause": hangup_cause,
                    "hangup_source": hangup_source,
                    "sip_code": sip_code,
                    "disposition": disposition
                }}
            )
            
            # Clean up conference
            if internal_call_id in active_conferences:
                del active_conferences[internal_call_id]
                logger.info(f"🧹 Cleaned up conference for: {internal_call_id}")
            
            ended_call = calls_collection.find_one({"call_id": internal_call_id})
            if ended_call:
                ended_call["_id"] = str(ended_call["_id"])
                await manager.broadcast({
                    "type": "call_ended",
                    "call": ended_call
                })
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"❌ Webhook error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"status": "error", "message": str(e)}


# ============================================================================
# HANGUP
# ============================================================================

@router.post("/hangup/{call_id}")
async def hangup_call(call_id: str):
    """Hangup call"""
    try:
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")
        
        current_status = call_doc.get("status")
        if current_status in ["ended", "completed", "failed"]:
            logger.info(f"ℹ️ Call {call_id} already ended")
            return {
                "status": "already_ended",
                "call_id": call_id,
                "duration": call_doc.get("duration", 0)
            }
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        pstn_call_control_id = call_doc.get("telnyx_call_control_id")
        
        if pstn_call_control_id:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/hangup",
                        headers=headers,
                    )
                logger.info(f"✅ Call hung up: {pstn_call_control_id}")
            except Exception as e:
                logger.warning(f"⚠️ Hangup error: {e}")
        
        started_at = call_doc.get("answered_at") or call_doc.get("started_at")
        duration = 0
        if started_at:
            duration = int((datetime.utcnow() - started_at).total_seconds())
        
        calls_collection.update_one(
            {"call_id": call_id},
            {"$set": {
                "status": "ended",
                "ended_at": datetime.utcnow(),
                "duration": duration,
                "hangup_cause": "USER_HANGUP",
                "hangup_source": "client"
            }}
        )
        
        await manager.broadcast({
            "type": "call_ended",
            "call_id": call_id,
            "duration": duration
        })
        
        logger.info(f"📴 Call ended: {call_id}")
        
        return {
            "status": "ended",
            "call_id": call_id,
            "duration": duration
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Hangup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{call_id}")
async def get_status(call_id: str):
    """Get call status"""
    calls_collection = db.get_db()["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {
        "call_id": call_id,
        "status": call_doc.get("status"),
        "direction": call_doc.get("direction", "outbound"),
        "to": call_doc.get("to_number"),
        "from": call_doc.get("from_number"),
        "duration": call_doc.get("duration", 0),
        "is_recording": call_doc.get("is_recording", False),
        "has_recording": call_doc.get("has_recording", False),
        "recording_type": call_doc.get("recording_type"),
        "conference_id": call_doc.get("conference_id"),
        "recording_url": call_doc.get("recording_url"),
    }

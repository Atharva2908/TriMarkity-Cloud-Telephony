"""
WebRTC Bridge Module - Separate from Telnyx Integration
Handles WebRTC + PSTN call bridging for browser audio + API endpoints for call logs
"""

import os
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
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

# Telnyx Configuration - Using environment variables
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

active_calls = {}

# WebSocket Connection Manager for real-time updates
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
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
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
# API ENDPOINTS FOR CALL LOGS - FIXES 404 ERRORS
# ============================================================================

@router.get("/logs")
async def get_call_logs(limit: int = 100, skip: int = 0):
    """
    Get all call logs with pagination
    THIS ENDPOINT WAS MISSING - FIXES THE 404 ERROR
    """
    try:
        calls_collection = db.get_db()["call_logs"]
        
        # Get logs sorted by most recent first
        logs_cursor = calls_collection.find().sort("created_at", -1).skip(skip).limit(limit)
        logs = list(logs_cursor)
        
        # Convert ObjectId to string for JSON serialization
        for log in logs:
            log["_id"] = str(log["_id"])
            # Convert datetime to ISO string if present
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
        
        # Try to find by call_id first, then by _id
        log = calls_collection.find_one({"call_id": log_id})
        if not log:
            from bson import ObjectId
            try:
                log = calls_collection.find_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if not log:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        # Convert ObjectId and datetime to strings
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
    """
    Update call log (notes, disposition, tags)
    """
    try:
        calls_collection = db.get_db()["call_logs"]
        
        # Build update document
        update_doc = {}
        if update.notes is not None:
            update_doc["notes"] = update.notes
        if update.disposition is not None:
            update_doc["disposition"] = update.disposition
        if update.tags is not None:
            update_doc["tags"] = update.tags
        
        update_doc["updated_at"] = datetime.utcnow()
        
        # Try to update by call_id first
        result = calls_collection.update_one(
            {"call_id": log_id},
            {"$set": update_doc}
        )
        
        # If not found, try by _id
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
        
        # Get updated log
        updated_log = calls_collection.find_one({"call_id": log_id})
        if not updated_log:
            from bson import ObjectId
            try:
                updated_log = calls_collection.find_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if updated_log:
            updated_log["_id"] = str(updated_log["_id"])
            
            # Broadcast update via WebSocket
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
        
        # Try to delete by call_id first
        result = calls_collection.delete_one({"call_id": log_id})
        
        # If not found, try by _id
        if result.deleted_count == 0:
            from bson import ObjectId
            try:
                result = calls_collection.delete_one({"_id": ObjectId(log_id)})
            except:
                pass
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Call log not found")
        
        # Broadcast deletion via WebSocket
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
# WEBSOCKET ENDPOINT FOR REAL-TIME UPDATES
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time call log updates
    Connects to /api/webrtc/ws
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle ping/pong
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
# CALL CONTROL ENDPOINTS (EXISTING)
# ============================================================================

@router.post("/initiate")
async def initiate_call(request: InitiateCallRequest):
    """Create PSTN call - WebRTC client in browser will auto-register"""
    try:
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        internal_call_id = str(uuid.uuid4())
        
        # Get default outbound number from database
        numbers_collection = db.get_db()["call_numbers"]
        default_number_doc = numbers_collection.find_one({"is_default": True})
        
        if not default_number_doc:
            raise HTTPException(
                status_code=400,
                detail="No default outbound number configured. Please set a default number in your settings."
            )
        
        from_number = default_number_doc["number"]
        logger.info(f"📞 Using caller ID: {from_number}")
        
        # Create PSTN leg with proper configuration
        pstn_payload = {
            "connection_id": TELNYX_VOICE_CONNECTION_ID,
            "to": request.to_number,
            "from": from_number,
            "webhook_url": f"{TELNYX_WEBHOOK_BASE}/api/webrtc/webhook/telnyx",
            "client_state": base64.b64encode(json.dumps({
                "internal_call_id": internal_call_id,
                "leg": "pstn"
            }).encode()).decode(),
            "timeout_secs": 60,
            "time_limit_secs": 14400,
            "answering_machine_detection": "disabled",
        }
        
        logger.info(f"📞 Creating PSTN leg: {from_number} → {request.to_number}")
        
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
        
        # Store in database
        calls_collection = db.get_db()["call_logs"]
        call_doc = {
            "call_id": internal_call_id,
            "telnyx_call_control_id": pstn_call_control_id,
            "from_number": from_number,
            "to_number": request.to_number,
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
        
        # Convert for JSON response
        call_doc["_id"] = str(call_doc["_id"])
        
        # Broadcast new call via WebSocket
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

@router.post("/webhook/telnyx")
async def telnyx_webhook(request: Request):
    """Handle webhooks and auto-start recording when call answered"""
    payload = await request.json()
    
    try:
        data = payload.get("data", {})
        event_type = data.get("event_type")
        event_payload = data.get("payload", {})
        
        logger.info(f"📞 Webhook event: {event_type}")
        
        # Handle call.recording.saved
        if event_type == "call.recording.saved":
            call_control_id = event_payload.get("call_control_id")
            recording_urls = event_payload.get("recording_urls", {})
            public_recording_urls = event_payload.get("public_recording_urls", {})
            
            recording_url = (
                public_recording_urls.get("mp3") or 
                public_recording_urls.get("wav") or
                recording_urls.get("mp3") or 
                recording_urls.get("wav")
            )
            
            if recording_url:
                calls_collection = db.get_db()["call_logs"]
                result = calls_collection.update_one(
                    {"telnyx_call_control_id": call_control_id},
                    {"$set": {
                        "recording_url": recording_url,
                        "recording_saved_at": datetime.utcnow(),
                        "has_recording": True
                    }}
                )
                
                if result.modified_count > 0:
                    logger.info(f"💾 Recording saved: {recording_url}")
                    
                    # Broadcast recording saved event
                    updated_call = calls_collection.find_one({"telnyx_call_control_id": call_control_id})
                    if updated_call:
                        updated_call["_id"] = str(updated_call["_id"])
                        await manager.broadcast({
                            "type": "recording_saved",
                            "call": updated_call
                        })
            
            return {"status": "ok"}
        
        # Log hangup details
        if event_type in ["call.hangup", "call.ended"]:
            hangup_cause = event_payload.get("hangup_cause", "unknown")
            hangup_source = event_payload.get("hangup_source", "unknown")
            sip_code = event_payload.get("sip_code", "unknown")
            logger.info(f"📴 Call ended - Cause: {hangup_cause}, Source: {hangup_source}, SIP: {sip_code}")
        
        client_state_b64 = event_payload.get("client_state", "")
        if not client_state_b64:
            return {"status": "ignored"}
        
        client_state = json.loads(base64.b64decode(client_state_b64).decode())
        internal_call_id = client_state.get("internal_call_id")
        leg = client_state.get("leg")
        
        if not internal_call_id:
            return {"status": "ignored"}
        
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": internal_call_id})
        
        if not call_doc:
            logger.warning(f"⚠️ Call not found: {internal_call_id}")
            return {"status": "call not found"}
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # When PSTN answers - update status and auto-start recording
        if event_type == "call.answered" and leg == "pstn":
            pstn_call_control_id = event_payload.get("call_control_id")
            
            logger.info(f"📱 Call answered: {pstn_call_control_id}")
            
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {
                    "status": "active",
                    "answered_at": datetime.utcnow()
                }}
            )
            
            # Broadcast call answered
            updated_call = calls_collection.find_one({"call_id": internal_call_id})
            if updated_call:
                updated_call["_id"] = str(updated_call["_id"])
                await manager.broadcast({
                    "type": "call_answered",
                    "call": updated_call
                })
            
            # Auto-start recording
            await asyncio.sleep(1)
            
            if not call_doc.get("recording_requested"):
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        record_response = await client.post(
                            f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_start",
                            headers=headers,
                            json={"format": "mp3", "channels": "dual"}
                        )
                    
                    if record_response.status_code == 200:
                        logger.info(f"🔴 Recording auto-started: {internal_call_id}")
                        calls_collection.update_one(
                            {"call_id": internal_call_id},
                            {"$set": {
                                "is_recording": True,
                                "recording_requested": True,
                                "recording_started_at": datetime.utcnow()
                            }}
                        )
                except Exception as e:
                    logger.error(f"❌ Auto-record error: {str(e)}")
        
        elif event_type == "call.initiated":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {"status": "ringing"}}
            )
            logger.info(f"📱 Call ringing: {internal_call_id}")
        
        elif event_type == "call.recording.started":
            logger.info(f"🔴 Recording confirmed: {internal_call_id}")
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {
                    "is_recording": True,
                    "recording_confirmed_at": datetime.utcnow()
                }}
            )
        
        elif event_type in ["call.hangup", "call.ended"]:
            hangup_cause = event_payload.get("hangup_cause", "normal")
            hangup_source = event_payload.get("hangup_source", "unknown")
            sip_code = event_payload.get("sip_code", "unknown")
            
            started_at = call_doc.get("answered_at") or call_doc.get("started_at")
            duration = 0
            if started_at:
                duration = int((datetime.utcnow() - started_at).total_seconds())
            
            # Determine disposition based on hangup cause
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
            
            # Broadcast call ended
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
        return {"status": "error", "message": str(e)}

# ✅ FIXED: Idempotent hangup endpoint
@router.post("/hangup/{call_id}")
async def hangup_call(call_id: str):
    """
    Hangup call and stop recording - IDEMPOTENT (safe to call multiple times)
    Returns success even if call is already ended
    """
    try:
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")
        
        # ✅ Check if call is already ended
        current_status = call_doc.get("status")
        if current_status in ["ended", "completed", "failed"]:
            logger.info(f"ℹ️ Call {call_id} already ended (status: {current_status})")
            return {
                "status": "already_ended",
                "call_id": call_id,
                "duration": call_doc.get("duration", 0),
                "message": "Call was already ended"
            }
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        pstn_call_control_id = call_doc.get("telnyx_call_control_id")
        
        # Try to stop recording first (ignore errors)
        if call_doc.get("is_recording") and pstn_call_control_id:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_stop",
                        headers=headers,
                    )
                logger.info(f"⏹️ Recording stopped: {call_id}")
            except httpx.TimeoutException:
                logger.warning(f"⚠️ Recording stop timeout for {call_id}")
            except Exception as e:
                logger.warning(f"⚠️ Recording stop error (may already be stopped): {e}")
        
        # Try to hangup call (ignore errors for already-ended calls)
        if pstn_call_control_id:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/hangup",
                        headers=headers,
                    )
                
                if response.status_code == 200:
                    logger.info(f"✅ Call hung up: {pstn_call_control_id}")
                elif response.status_code == 422:
                    # 422 = Call already ended on Telnyx side
                    logger.info(f"ℹ️ Call already ended on Telnyx: {pstn_call_control_id}")
                else:
                    logger.warning(f"⚠️ Hangup returned {response.status_code}: {response.text}")
                    
            except httpx.TimeoutException:
                logger.warning(f"⚠️ Hangup timeout for {pstn_call_control_id}")
            except Exception as e:
                logger.warning(f"⚠️ Hangup error (may already be ended): {e}")
        
        # ✅ Always update database state (even if Telnyx calls failed)
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
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Broadcast call ended event
        await manager.broadcast({
            "type": "call_ended",
            "call_id": call_id,
            "duration": duration
        })
        
        logger.info(f"✅ Call cleanup complete: {call_id}")
        return {
            "status": "ended",
            "call_id": call_id,
            "duration": duration,
            "message": "Call ended successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Hangup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recording/start/{call_id}")
async def start_recording(call_id: str):
    """Manually start recording"""
    try:
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")
        
        if call_doc.get("status") != "active":
            raise HTTPException(
                status_code=400, 
                detail=f"Call must be active to start recording (current status: {call_doc.get('status')})"
            )
        
        pstn_call_control_id = call_doc.get("telnyx_call_control_id")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_start",
                headers=headers,
                json={"format": "mp3", "channels": "dual"}
            )
        
        if response.status_code == 200:
            calls_collection.update_one(
                {"call_id": call_id},
                {"$set": {
                    "is_recording": True, 
                    "recording_requested": True,
                    "recording_started_at": datetime.utcnow()
                }}
            )
            logger.info(f"🔴 Recording started: {call_id}")
            return {"status": "recording_started", "call_id": call_id}
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(status_code=400, detail=error_data.get("errors", response.text))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Start recording error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recording/stop/{call_id}")
async def stop_recording(call_id: str):
    """Manually stop recording"""
    try:
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")
        
        pstn_call_control_id = call_doc.get("telnyx_call_control_id")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_stop",
                headers=headers,
            )
        
        if response.status_code in [200, 422]:
            calls_collection.update_one(
                {"call_id": call_id},
                {"$set": {
                    "is_recording": False,
                    "recording_stopped_at": datetime.utcnow()
                }}
            )
            logger.info(f"⏹️ Recording stopped: {call_id}")
            return {"status": "recording_stopped", "call_id": call_id}
        else:
            error_data = response.json() if response.text else {}
            raise HTTPException(status_code=400, detail=error_data.get("errors", response.text))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Stop recording error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{call_id}")
async def get_status(call_id: str):
    """Get call status with recording info"""
    calls_collection = db.get_db()["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {
        "call_id": call_id,
        "status": call_doc.get("status"),
        "to": call_doc.get("to_number"),
        "from": call_doc.get("from_number"),
        "duration": call_doc.get("duration", 0),
        "is_recording": call_doc.get("is_recording", False),
        "has_recording": call_doc.get("has_recording", False),
        "recording_url": call_doc.get("recording_url"),
        "hangup_cause": call_doc.get("hangup_cause"),
        "hangup_source": call_doc.get("hangup_source"),
        "sip_code": call_doc.get("sip_code"),
        "disposition": call_doc.get("disposition"),
        "notes": call_doc.get("notes", ""),
        "tags": call_doc.get("tags", []),
    }

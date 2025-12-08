"""
WebRTC Bridge Module - Separate from Telnyx Integration
Handles WebRTC + PSTN call bridging for browser audio
"""

import os
from fastapi import APIRouter, HTTPException, Request
from database import db
from pydantic import BaseModel
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


class InitiateCallRequest(BaseModel):
    to_number: str
    from_number: str


@router.post("/webrtc/initiate")
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
        
        # Create PSTN leg with proper configuration to avoid false busy signals
        pstn_payload = {
            "connection_id": TELNYX_VOICE_CONNECTION_ID,
            "to": request.to_number,
            "from": from_number,
            "webhook_url": f"{TELNYX_WEBHOOK_BASE}/api/webrtc/webhook/telnyx",
            "client_state": base64.b64encode(json.dumps({
                "internal_call_id": internal_call_id,
                "leg": "pstn"
            }).encode()).decode(),
            # Add these parameters to avoid false busy signals
            "timeout_secs": 60,  # Wait up to 60 seconds for answer
            "time_limit_secs": 14400,  # 4 hour max call duration
            "answering_machine_detection": "disabled",  # Disable AMD to avoid delays
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
        }
        calls_collection.insert_one(call_doc)
        
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
        
        # Log hangup cause if call fails - helps debug busy signals
        if event_type in ["call.hangup", "call.ended"]:
            hangup_cause = event_payload.get("hangup_cause", "unknown")
            hangup_source = event_payload.get("hangup_source", "unknown")
            sip_code = event_payload.get("sip_code", "unknown")
            logger.info(f"📴 Call ended - Cause: {hangup_cause}, Source: {hangup_source}, SIP: {sip_code}")
        
        client_state_b64 = event_payload.get("client_state", "")
        if not client_state_b64:
            logger.warning("⚠️ No client_state in webhook")
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
        
        # When PSTN answers - update status to active and AUTO-START RECORDING
        if event_type == "call.answered" and leg == "pstn":
            pstn_call_control_id = event_payload.get("call_control_id")
            
            logger.info(f"📱 Call answered by client: {pstn_call_control_id}")
            
            # Update call to active FIRST
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {"status": "active", "answered_at": datetime.utcnow()}}
            )
            if internal_call_id in active_calls:
                active_calls[internal_call_id]["status"] = "active"
            
            # AUTO-START RECORDING with delay to ensure call is fully established
            await asyncio.sleep(1)  # Wait 1 second for audio to stabilize
            
            # Only try to start recording if not already requested
            if not call_doc.get("recording_requested"):
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        record_response = await client.post(
                            f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_start",
                            headers=headers,
                            json={
                                "format": "mp3",
                                "channels": "dual"
                            }
                        )
                    
                    if record_response.status_code == 200:
                        logger.info(f"🔴 Recording auto-started for call: {internal_call_id}")
                        calls_collection.update_one(
                            {"call_id": internal_call_id},
                            {"$set": {
                                "is_recording": True,
                                "recording_requested": True,
                                "recording_started_at": datetime.utcnow()
                            }}
                        )
                    else:
                        logger.warning(f"⚠️ Auto-record failed ({record_response.status_code}): {record_response.text}")
                        calls_collection.update_one(
                            {"call_id": internal_call_id},
                            {"$set": {"recording_requested": True}}
                        )
                except Exception as e:
                    logger.error(f"❌ Auto-record error: {str(e)}")
                    calls_collection.update_one(
                        {"call_id": internal_call_id},
                        {"$set": {"recording_requested": True}}
                    )
        
        # Update status for other events
        elif event_type == "call.initiated":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {"status": "ringing"}}
            )
            if internal_call_id in active_calls:
                active_calls[internal_call_id]["status"] = "ringing"
            logger.info(f"📱 Call ringing: {internal_call_id}")
        
        # Handle recording started confirmation
        elif event_type == "call.recording.started":
            logger.info(f"🔴 Recording confirmed started: {internal_call_id}")
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {
                    "is_recording": True,
                    "recording_confirmed_at": datetime.utcnow()
                }}
            )
        
        # Handle call end from EITHER side (client or browser)
        elif event_type in ["call.hangup", "call.ended"]:
            hangup_cause = event_payload.get("hangup_cause", "normal")
            hangup_source = event_payload.get("hangup_source", "unknown")
            sip_code = event_payload.get("sip_code", "unknown")
            
            logger.info(f"📴 Call ended: {internal_call_id}, cause: {hangup_cause}, source: {hangup_source}, SIP: {sip_code}")
            
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {"$set": {
                    "status": "ended",
                    "ended_at": datetime.utcnow(),
                    "hangup_cause": hangup_cause,
                    "hangup_source": hangup_source,
                    "sip_code": sip_code
                }}
            )
            if internal_call_id in active_calls:
                del active_calls[internal_call_id]
        
        # Handle recording.saved event (when recording is ready for download)
        elif event_type == "recording.saved":
            recording_urls = event_payload.get("recording_urls", {})
            recording_url = recording_urls.get("mp3") or recording_urls.get("wav")
            
            if recording_url:
                calls_collection.update_one(
                    {"call_id": internal_call_id},
                    {"$set": {
                        "recording_url": recording_url,
                        "recording_saved_at": datetime.utcnow()
                    }}
                )
                logger.info(f"💾 Recording saved: {recording_url}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"❌ Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.post("/hangup/{call_id}")
async def hangup_call(call_id: str):
    """Hangup call and stop recording"""
    try:
        calls_collection = db.get_db()["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        pstn_call_control_id = call_doc.get("telnyx_call_control_id")
        
        # Stop recording first if active
        if call_doc.get("is_recording") and pstn_call_control_id:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/record_stop",
                        headers=headers,
                    )
                logger.info(f"⏹️ Recording stopped for: {call_id}")
            except Exception as e:
                logger.error(f"Error stopping recording: {e}")
        
        # Hangup call
        if pstn_call_control_id:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{TELNYX_BASE_URL}/calls/{pstn_call_control_id}/actions/hangup",
                        headers=headers,
                    )
                if response.status_code == 200:
                    logger.info(f"📴 Hung up call: {pstn_call_control_id}")
                elif response.status_code == 422:
                    logger.info(f"📴 Call already ended: {pstn_call_control_id}")
                else:
                    logger.warning(f"⚠️ Hangup response {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"Error hanging up {pstn_call_control_id}: {e}")
        
        calls_collection.update_one(
            {"call_id": call_id},
            {"$set": {"status": "ended", "ended_at": datetime.utcnow()}}
        )
        
        if call_id in active_calls:
            del active_calls[call_id]
        
        logger.info(f"✅ Call ended: {call_id}")
        return {"status": "ended"}
        
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
            raise HTTPException(status_code=400, detail="Call must be active to start recording")
        
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
                {"$set": {"is_recording": True, "recording_requested": True}}
            )
            logger.info(f"🔴 Recording manually started for: {call_id}")
            return {"status": "recording_started"}
        else:
            logger.error(f"❌ Recording start failed: {response.text}")
            raise HTTPException(status_code=400, detail=response.text)
            
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
        
        if response.status_code in [200, 422]:  # 422 = already stopped
            calls_collection.update_one(
                {"call_id": call_id},
                {"$set": {"is_recording": False}}
            )
            logger.info(f"⏹️ Recording manually stopped for: {call_id}")
            return {"status": "recording_stopped"}
        else:
            logger.error(f"❌ Recording stop failed: {response.text}")
            raise HTTPException(status_code=400, detail=response.text)
            
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
        "is_recording": call_doc.get("is_recording", False),
        "recording_url": call_doc.get("recording_url"),
        "hangup_cause": call_doc.get("hangup_cause"),
        "hangup_source": call_doc.get("hangup_source"),
        "sip_code": call_doc.get("sip_code"),
    }

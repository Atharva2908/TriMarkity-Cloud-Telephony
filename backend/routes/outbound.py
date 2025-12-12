from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import CallLog, CallStatus
from database import db
from datetime import datetime, timedelta
import uuid
import asyncio
import httpx
import os
import logging


logger = logging.getLogger(__name__)
router = APIRouter()


TELNYX_API_KEY = os.getenv("TELNYX_API_KEY")
TELNYX_BASE_URL = os.getenv("TELNYX_BASE_URL", "https://api.telnyx.com/v2")
TELNYX_CONNECTION_ID = os.getenv("TELNYX_CONNECTION_ID")


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


class DTMFRequest(BaseModel):
    call_control_id: str
    digits: str


class SpeakRequest(BaseModel):
    call_control_id: str
    text: str
    voice: str = "female"
    language: str = "en-US"


# Track active calls for reconnect and hangup logic
active_calls = {}


@router.post("/outbound/initiate")
async def initiate_outbound_call(request: OutboundCallRequest):
    """Initiate an outbound call with optional TTS, auto-reconnect, and auto-hangup"""
    call_id = str(uuid.uuid4())
    
    try:
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Create Telnyx call using REST API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TELNYX_BASE_URL}/calls",
                headers=headers,
                json={
                    "connection_id": TELNYX_CONNECTION_ID,
                    "to": request.to_number,
                    "from": request.from_number,
                    "webhook_url": f"{os.getenv('WEBHOOK_URL', 'https://your-domain.com')}/api/webhooks/call",
                    "webhook_url_method": "POST",
                }
            )
        
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        call_data = response.json().get("data", {})
        telnyx_call_control_id = call_data.get("call_control_id")
        telnyx_session_id = call_data.get("call_session_id")
        
        logger.info(f"📞 Outbound call initiated: {call_id} -> {request.to_number}")
        
        # Speak TTS message if provided
        if request.tts_message:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{TELNYX_BASE_URL}/calls/{telnyx_call_control_id}/actions/speak",
                    headers=headers,
                    json={
                        "payload": request.tts_message,
                        "voice": "female",
                        "language": "en-US"
                    }
                )
            logger.info(f"🔊 TTS message sent: {request.tts_message}")
        
    except Exception as e:
        logger.error(f"❌ Telnyx call creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create call: {str(e)}")
    
    # Store in MongoDB
    call_log = CallLog(
        call_id=call_id,
        from_number=request.from_number,
        to_number=request.to_number,
        status=CallStatus.DIALING,
        started_at=datetime.utcnow(),
        telnyx_call_control_id=telnyx_call_control_id,
        telnyx_session_id=telnyx_session_id
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
        "call_control_id": telnyx_call_control_id,
    }
    
    # Schedule auto-hangup
    if request.auto_hangup_duration:
        asyncio.create_task(_auto_hangup(call_id, request.auto_hangup_duration))
    
    return {
        "call_id": call_id,
        "call_control_id": telnyx_call_control_id,
        "call_session_id": telnyx_session_id,
        "status": "initiating",
        "from": request.from_number,
        "to": request.to_number,
        "message": f"Outbound call initiated. TTS: {request.tts_message or 'None'}"
    }


@router.post("/send-dtmf")
async def send_dtmf(request: DTMFRequest):
    """
    Send DTMF tones during active call
    Used to navigate IVR menus (Press 1, 2, 3, etc.)
    """
    try:
        logger.info(f"🔢 Sending DTMF: {request.digits} to call {request.call_control_id}")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # ✅ Use REST API to send DTMF
        async with httpx.AsyncClient(timeout=10.0) as client:
            dtmf_response = await client.post(
                f"{TELNYX_BASE_URL}/calls/{request.call_control_id}/actions/send_dtmf",
                headers=headers,
                json={"digits": request.digits}
            )
        
        if dtmf_response.status_code == 200:
            logger.info(f"✅ DTMF sent successfully: {request.digits}")
            return {
                "status": "success",
                "call_control_id": request.call_control_id,
                "digits": request.digits,
                "message": f"DTMF tones '{request.digits}' sent successfully"
            }
        else:
            logger.error(f"❌ DTMF failed: {dtmf_response.status_code} - {dtmf_response.text}")
            raise HTTPException(status_code=400, detail=f"DTMF failed: {dtmf_response.text}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ DTMF error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/speak")
async def speak_on_call(request: SpeakRequest):
    """
    Speak text on active call using Text-to-Speech
    """
    try:
        logger.info(f"🔊 Speaking on call {request.call_control_id}: {request.text}")
        
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{TELNYX_BASE_URL}/calls/{request.call_control_id}/actions/speak",
                headers=headers,
                json={
                    "payload": request.text,
                    "voice": request.voice,
                    "language": request.language
                }
            )
        
        if response.status_code == 200:
            logger.info(f"✅ TTS sent successfully")
            return {
                "status": "success",
                "call_control_id": request.call_control_id,
                "text": request.text,
                "message": "TTS message sent successfully"
            }
        else:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{call_id}/hangup")
async def hangup_outbound_call(call_id: str):
    """End an outbound call"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # Hangup via Telnyx if call_control_id exists
    try:
        if call.get("telnyx_call_control_id"):
            headers = {
                "Authorization": f"Bearer {TELNYX_API_KEY}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{TELNYX_BASE_URL}/calls/{call['telnyx_call_control_id']}/actions/hangup",
                    headers=headers
                )
            logger.info(f"📴 Telnyx call hung up: {call_id}")
    except Exception as e:
        logger.warning(f"⚠️ Telnyx hangup failed: {str(e)}")
    
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
    """Start recording a call with DUAL-CHANNEL (stereo)"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    try:
        if call.get("telnyx_call_control_id"):
            headers = {
                "Authorization": f"Bearer {TELNYX_API_KEY}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{TELNYX_BASE_URL}/calls/{call['telnyx_call_control_id']}/actions/record_start",
                    headers=headers,
                    json={
                        "format": "wav",
                        "channels": "dual"  # ✅ DUAL-CHANNEL RECORDING
                    }
                )
            
            if response.status_code == 200:
                calls_collection.update_one(
                    {"call_id": call_id},
                    {"$set": {
                        "is_recording": True,
                        "recording_started_at": datetime.utcnow(),
                        "recording_channels": "dual",
                        "recording_format": "wav"
                    }}
                )
                
                logger.info(f"🔴 DUAL-CHANNEL recording started for call: {call_id}")
                
                return {
                    "call_id": call_id,
                    "recording_started": True,
                    "channels": "dual",
                    "format": "wav",
                    "message": "Dual-channel (stereo) recording started successfully"
                }
            else:
                raise HTTPException(status_code=response.status_code, detail=response.text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Recording start error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    raise HTTPException(status_code=400, detail="Call control ID not found")


@router.post("/{call_id}/recording/stop")
async def stop_recording(call_id: str):
    """Stop recording a call"""
    calls_collection = db.get_db()["call_logs"]
    call = calls_collection.find_one({"call_id": call_id})
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    try:
        if call.get("telnyx_call_control_id"):
            headers = {
                "Authorization": f"Bearer {TELNYX_API_KEY}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{TELNYX_BASE_URL}/calls/{call['telnyx_call_control_id']}/actions/record_stop",
                    headers=headers
                )
            
            if response.status_code == 200:
                calls_collection.update_one(
                    {"call_id": call_id},
                    {"$set": {"is_recording": False}}
                )
                
                logger.info(f"⏹️ Recording stopped for call: {call_id}")
                
                return {
                    "call_id": call_id,
                    "recording_stopped": True,
                    "message": "Recording stopped successfully"
                }
            else:
                raise HTTPException(status_code=response.status_code, detail=response.text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Recording stop error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    raise HTTPException(status_code=400, detail="Call control ID not found")


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
        # Hangup via Telnyx
        try:
            if call.get("telnyx_call_control_id"):
                headers = {
                    "Authorization": f"Bearer {TELNYX_API_KEY}",
                    "Content-Type": "application/json"
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{TELNYX_BASE_URL}/calls/{call['telnyx_call_control_id']}/actions/hangup",
                        headers=headers
                    )
                logger.info(f"⏰ Auto-hangup executed for call: {call_id}")
        except Exception as e:
            logger.error(f"❌ Auto-hangup failed: {str(e)}")
        
        calls_collection.update_one(
            {"call_id": call_id},
            {
                "$set": {
                    "status": CallStatus.ENDED,
                    "ended_at": datetime.utcnow()
                }
            }
        )
        
        # Clean up
        if call_id in active_calls:
            del active_calls[call_id]


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
        
        logger.info(f"🔄 Reconnecting call {call_id} (attempt {call_info['reconnect_attempts']})")
        
        # Wait before retrying
        await asyncio.sleep(5)
        
        # Re-initiate call
        try:
            headers = {
                "Authorization": f"Bearer {TELNYX_API_KEY}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{TELNYX_BASE_URL}/calls",
                    headers=headers,
                    json={
                        "connection_id": TELNYX_CONNECTION_ID,
                        "to": call_info["to_number"],
                        "from": call_info["from_number"],
                        "webhook_url": f"{os.getenv('WEBHOOK_URL', 'https://your-domain.com')}/api/webhooks/call",
                        "webhook_url_method": "POST",
                    }
                )
            
            if response.status_code in (200, 201):
                call_data = response.json().get("data", {})
                
                # Update with new call control ID
                call_info["call_control_id"] = call_data.get("call_control_id")
                
                calls_collection.update_one(
                    {"call_id": call_id},
                    {
                        "$set": {
                            "telnyx_call_control_id": call_data.get("call_control_id"),
                            "telnyx_session_id": call_data.get("call_session_id")
                        }
                    }
                )
                
                logger.info(f"✅ Reconnection successful for call: {call_id}")
            else:
                raise Exception(f"API returned {response.status_code}: {response.text}")
            
        except Exception as e:
            logger.error(f"❌ Reconnection failed: {str(e)}")


@router.get("/health")
async def outbound_health():
    """Health check for outbound calls"""
    return {
        "status": "healthy",
        "service": "outbound_calls",
        "active_calls": len(active_calls),
        "timestamp": datetime.utcnow().isoformat()
    }

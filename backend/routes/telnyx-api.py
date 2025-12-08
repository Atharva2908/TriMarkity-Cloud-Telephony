"""
Telnyx API Integration for Call Control
Handles outbound calling, webhooks, and call management
Complete workflow implementation
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import httpx
import logging
from datetime import datetime
from database import db
from models import CallLog, CallStatus
import os
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

TELNYX_API_KEY = os.getenv("TELNYX_API_V2_KEY")  # no hardcoded default
TELNYX_API_URL = "https://api.telnyx.com/v2"
TELNYX_WEBHOOK_BASE = os.getenv("TELNYX_WEBHOOK_URL", "http://localhost:8000")

# Always call from your Telnyx number (E.164)
FIXED_FROM_NUMBER = "+14809031614"  # your bought number

class OutboundCallRequest(BaseModel):
    to_number: str
    # from_number is optional; server overrides with FIXED_FROM_NUMBER
    from_number: Optional[str] = None
    connection_id: Optional[str] = None

class TelnyxSettings(BaseModel):
    api_key: str
    api_v2_key: str
    webhook_url: str
    connection_id: Optional[str] = None

def get_telnyx_headers():
    """Get headers for Telnyx API requests"""
    if not TELNYX_API_KEY:
        logger.error("TELNYX_API_V2_KEY is not set")
        raise HTTPException(status_code=500, detail="Telnyx API key not configured")

    logger.info(f"Using Telnyx API key: {TELNYX_API_KEY[:6]}...{TELNYX_API_KEY[-4:]}")
    return {
        "Authorization": f"Bearer {TELNYX_API_KEY}",
        "Content-Type": "application/json",
    }

@router.post("/dial")
async def initiate_telnyx_call(request: OutboundCallRequest):
    """
    Initiate outbound call via Telnyx Call Control API
    Creates call log and triggers webhook for real-time updates
    """
    calls_collection = db.get_db()["call_logs"]

    # Demo mode if key missing
    if not TELNYX_API_KEY:
        call_id = str(uuid.uuid4())
        call_log = CallLog(
            call_id=call_id,
            from_number= FIXED_FROM_NUMBER,
            to_number= request.to_number,
            status= CallStatus.DIALING,
            started_at= datetime.utcnow(),
        )
        calls_collection.insert_one(call_log.dict())
        logger.info(f"Demo mode call: {call_id}")
        return {
            "call_id": call_id,
            "status": "dialing",
            "to_number": request.to_number,
            "from_number": FIXED_FROM_NUMBER,
            "mode": "demo",
        }

    # Use a UUID as fallback but prefer Telnyx call_session_id
    call_id = str(uuid.uuid4())

    try:
        # Resolve connection_id
        connection_id = request.connection_id
        if not connection_id:
            config_collection = db.get_db()["telnyx_config"]
            config = config_collection.find_one({"key": "main"})
            connection_id = config.get("connection_id") if config else None

        if not connection_id:
            raise HTTPException(status_code=400, detail="Telnyx connection_id not configured")

        async with httpx.AsyncClient() as client:
            payload = {
                "to": [{"phone_number": request.to_number}],
                "from": {"phone_number": FIXED_FROM_NUMBER},
                "connection_id": connection_id,
                "webhook_url": f"{TELNYX_WEBHOOK_BASE}/webhooks/call",
                "webhook_url_method": "POST",
                "record": {"format": "mp3"},
            }

            response = await client.post(
                f"{TELNYX_API_URL}/calls",
                json=payload,
                headers=get_telnyx_headers(),
            )

            if response.status_code not in [200, 201]:
                error_msg = f"Telnyx API error: {response.text}"
                logger.error(error_msg)
                raise HTTPException(status_code=400, detail=error_msg)

            response_data = response.json()
            telnyx_call_id = response_data.get("data", {}).get("call_session_id", call_id)

            # Create call log entry using Telnyx call_session_id
            call_log = CallLog(
                call_id= telnyx_call_id,
                from_number= FIXED_FROM_NUMBER,
                to_number= request.to_number,
                status= CallStatus.DIALING,
                started_at= datetime.utcnow(),
            )
            calls_collection.insert_one(call_log.dict())

            logger.info(f"Call initiated: {telnyx_call_id} to {request.to_number}")

            return {
                "call_id": telnyx_call_id,
                "status": "dialing",
                "to_number": request.to_number,
                "from_number": FIXED_FROM_NUMBER,
                "telnyx_response": response_data,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating Telnyx call: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

@router.post("/hangup/{call_id}")
async def hangup_telnyx_call(call_id: str):
    """End Telnyx call and update database"""
    try:
        if TELNYX_API_KEY:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{TELNYX_API_URL}/calls/{call_id}",
                    headers=get_telnyx_headers(),
                )
                if response.status_code not in [200, 204]:
                    logger.warning(f"Telnyx hangup response: {response.status_code} {response.text}")

        # Update call log
        calls_collection = db.get_db()["call_logs"]
        calls_collection.update_one(
            {"call_id": call_id},
            {
                "$set": {
                    "status": CallStatus.ENDED,
                    "ended_at": datetime.utcnow(),
                }
            },
        )

        return {"message": "Call ended", "call_id": call_id}

    except Exception as e:
        logger.error(f"Error hanging up: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to hang up: {str(e)}")

@router.post("/webhooks/call")
async def telnyx_call_webhook(request: Request):
    """
    Receive Telnyx call events and update call_logs.
    Telnyx will POST events like call.initiated, call.ringing, call.answered, call.hangup.
    """
    payload = await request.json()
    logger.info(f"TELNYX WEBHOOK EVENT: {payload}")

    try:
        data = payload.get("data", {})
        event_type = data.get("event_type")
        call_session_id = (
            data.get("payload", {}).get("call_session_id")
            or data.get("payload", {}).get("call_control_id")
        )

        if not call_session_id:
            logger.warning("Webhook event missing call_session_id/call_control_id")
            return {"status": "ignored", "reason": "no call_session_id"}

        # Map Telnyx events to your CallStatus
        status_map = {
            "call.initiated": CallStatus.DIALING,
            "call.ringing": getattr(CallStatus, "RINGING", CallStatus.DIALING),
            "call.answered": CallStatus.ACTIVE,
            "call.bridged": CallStatus.ACTIVE,
            "call.hangup": CallStatus.ENDED,
            "call.ended": CallStatus.ENDED,
            "call.failed": getattr(CallStatus, "FAILED", CallStatus.ENDED),
        }

        new_status = status_map.get(event_type)
        if not new_status:
            logger.info(f"Unhandled Telnyx event_type: {event_type}")
            return {"status": "ignored", "event_type": event_type}

        calls_collection = db.get_db()["call_logs"]

        update_doc = {
            "status": new_status,
            "updated_at": datetime.utcnow(),
        }

        # For terminal events, set ended_at
        if new_status in [CallStatus.ENDED, getattr(CallStatus, "FAILED", CallStatus.ENDED)]:
            update_doc["ended_at"] = datetime.utcnow()

        result = calls_collection.update_one(
            {"call_id": call_session_id},
            {"$set": update_doc},
        )

        if result.matched_count == 0:
            logger.warning(f"No call_log found for call_id={call_session_id} in webhook")

        # If you have WebSocket broadcasting, you can call it here (pseudo-code):
        # await broadcast({"type": "call_status", "call_id": call_session_id, "status": new_status})

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

@router.get("/call-status/status/{call_id}")
async def get_call_status(call_id: str):
    """
    Return current call status and basic info for polling from the frontend.
    """
    calls_collection = db.get_db()["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})

    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")

    # Convert ObjectId to string if present
    call_doc["_id"] = str(call_doc["_id"])

    return {
        "call_id": call_doc.get("call_id"),
        "from_number": call_doc.get("from_number"),
        "to_number": call_doc.get("to_number"),
        "status": str(call_doc.get("status")),
        "started_at": call_doc.get("started_at"),
        "ended_at": call_doc.get("ended_at"),
    }

@router.get("/settings")
async def get_telnyx_settings():
    """Get current Telnyx configuration"""
    config_collection = db.get_db()["telnyx_config"]
    config = config_collection.find_one({"key": "main"})

    if not config:
        return {
            "api_key": "",
            "connection_id": "",
            "webhook_url": TELNYX_WEBHOOK_BASE,
            "configured": False,
        }

    return {
        "api_key": (config.get("api_key", "")[:20] + "...") if config.get("api_key") else "",
        "connection_id": config.get("connection_id", ""),
        "webhook_url": config.get("webhook_url", TELNYX_WEBHOOK_BASE),
        "configured": bool(config.get("api_v2_key")),
    }

@router.post("/settings")
async def update_telnyx_settings(settings: TelnyxSettings):
    """Update Telnyx configuration"""
    config_collection = db.get_db()["telnyx_config"]
    config_collection.update_one(
        {"key": "main"},
        {
            "$set": {
                "api_key": settings.api_key,
                "api_v2_key": settings.api_v2_key,
                "webhook_url": settings.webhook_url,
                "connection_id": settings.connection_id or "",
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return {"message": "Settings updated"}

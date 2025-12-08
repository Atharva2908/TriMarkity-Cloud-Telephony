"""
Telnyx Integration Module
Handles all interactions with Telnyx API for making calls and managing webhooks
"""

from fastapi import APIRouter, HTTPException, Request
from database import db
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import httpx  # Use httpx for async
from datetime import datetime
import logging
import os
import uuid

logger = logging.getLogger(__name__)

# You can mount with prefix in your main app: app.include_router(router, prefix="/api/telnyx")
router = APIRouter()

# Configuration from environment variables
TELNYX_API_KEY = os.getenv("TELNYX_API_V2_KEY")
TELNYX_BASE_URL = "https://api.telnyx.com/v2"
TELNYX_WEBHOOK_BASE = os.getenv("TELNYX_WEBHOOK_URL", "http://localhost:8000")
TELNYX_CONNECTION_ID = os.getenv("TELNYX_CONNECTION_ID")


class TelnyxCallRequest(BaseModel):
    to_number: str = Field(..., description="Destination phone number")
    # from_number is optional now; backend will use default number from DB
    from_number: Optional[str] = Field(
        None,
        description="Caller ID (ignored, server uses default number if configured)",
    )
    connection_id: Optional[str] = Field(
        None, description="Telnyx Call Control App ID"
    )
    custom_headers: Optional[dict] = None


class TelnyxWebhookConfig(BaseModel):
    webhook_url: str
    events: List[str] = ["call.initiated", "call.answered", "call.hangup"]


class TelnyxSettings(BaseModel):
    api_key: str
    api_v2_key: str
    webhook_url: str
    connection_id: Optional[str] = None


class DTMFRequest(BaseModel):
    digit: str = Field(..., min_length=1, max_length=16)


def get_telnyx_headers() -> Dict[str, str]:
    """Get Telnyx API headers."""
    try:
        config_collection = db.get_db()["telnyx_config"]
        config_doc = config_collection.find_one({"key": "main"})

        # Use database config if available, otherwise use environment variable
        api_key = config_doc.get("api_v2_key") if config_doc else TELNYX_API_KEY

        if not api_key:
            raise HTTPException(status_code=400, detail="Telnyx API key not configured")

        logger.info(f"Using Telnyx API key: {api_key[:6]}...{api_key[-4:]}")
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Telnyx headers: {e}")
        raise HTTPException(status_code=500, detail="Failed to get API credentials")


@router.post("/initiate-telnyx-call")
async def initiate_telnyx_call(request: TelnyxCallRequest):
    """
    Make a call via Telnyx API using correct Call Control App ID.
    Uses default outbound number from `call_numbers` collection as caller ID.
    """
    try:
        headers = get_telnyx_headers()

        # Resolve connection_id: request -> DB config -> env
        connection_id = request.connection_id
        if not connection_id:
            config_collection = db.get_db()["telnyx_config"]
            config_doc = config_collection.find_one({"key": "main"})
            connection_id = (
                config_doc.get("connection_id")
                if config_doc and config_doc.get("connection_id")
                else TELNYX_CONNECTION_ID
            )
        if not connection_id:
            raise HTTPException(
                status_code=400,
                detail="Telnyx Application ID (Call Control App ID) not configured",
            )

        logger.info(
            f"Using Telnyx Call Control App ID for call control: {connection_id}"
        )

        # Get default outbound number from DB
        numbers_collection = db.get_db()["call_numbers"]
        default_number_doc = numbers_collection.find_one({"is_default": True})

        if not default_number_doc:
            raise HTTPException(
                status_code=400,
                detail="No default outbound number configured in /api/numbers",
            )

        from_number = default_number_doc["number"]

        # Build Telnyx call payload
        call_data: Dict[str, Any] = {
            "to": request.to_number,
            "from": from_number,
            "connection_id": connection_id,
            "webhook_url": f"{TELNYX_WEBHOOK_BASE}/api/telnyx/webhooks/call",
            "webhook_url_method": "POST",
        }
        if request.custom_headers:
            call_data["custom_headers"] = request.custom_headers

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TELNYX_BASE_URL}/calls",
                headers=headers,
                json=call_data,
            )

        if response.status_code not in (200, 201):
            logger.error(f"Telnyx API error: {response.text}")
            raise HTTPException(
                status_code=400, detail=f"Telnyx API error: {response.text}"
            )

        # Safely extract data
        body = response.json() if response.content else {}
        response_data = body.get("data") or {}
        telnyx_session_id = response_data.get("call_session_id")
        telnyx_call_control_id = response_data.get("call_control_id")

        # Create internal call_id (UUID) and store Telnyx IDs alongside it
        internal_call_id = str(uuid.uuid4())

        calls_collection = db.get_db()["call_logs"]
        now = datetime.utcnow()
        call_doc = {
            "call_id": internal_call_id,
            "telnyx_session_id": telnyx_session_id,
            "telnyx_call_control_id": telnyx_call_control_id,
            "from_number": from_number,
            "to_number": request.to_number,
            "status": "dialing",
            "started_at": now,
            "created_at": now,
            "muted": False,
            "on_hold": False,
            "dtmf_buffer": [],
        }
        calls_collection.insert_one(call_doc)

        logger.info(
            f"Call initiated internal_id={internal_call_id}, "
            f"telnyx_session_id={telnyx_session_id}, to={request.to_number}"
        )
        return {
            "call_id": internal_call_id,
            "status": "dialing",
            "from_number": from_number,
            "to_number": request.to_number,
            "telnyx_response": response_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating Telnyx call: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to initiate call: {str(e)}"
        )


@router.post("/hangup-telnyx-call/{call_id}")
async def hangup_telnyx_call(call_id: str):
    """
    Hang up a Telnyx call.
    `call_id` here is your internal UUID; we look up Telnyx call_control_id in DB.
    """
    try:
        db_instance = db.get_db()
        calls_collection = db_instance["call_logs"]
        call_doc = calls_collection.find_one({"call_id": call_id})
        if not call_doc:
            raise HTTPException(status_code=404, detail="Call not found")

        telnyx_call_control_id = call_doc.get("telnyx_call_control_id")
        headers = get_telnyx_headers()

        if telnyx_call_control_id:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{TELNYX_BASE_URL}/calls/{telnyx_call_control_id}/actions/hangup",
                    headers=headers,
                )

            if response.status_code not in (200, 204, 202):
                logger.warning(
                    f"Telnyx hangup response: {response.status_code} - {response.text}"
                )

        # Update database
        calls_collection.update_one(
            {"call_id": call_id},
            {"$set": {"status": "ended", "ended_at": datetime.utcnow()}},
        )

        logger.info(f"Call hung up: {call_id}")
        return {"message": "Call ended", "call_id": call_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error hanging up Telnyx call: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to hang up: {str(e)}"
        )


@router.post("/webhooks/call")
async def telnyx_call_webhook(request: Request):
    """
    Receive Telnyx call events and update call_logs.
    This endpoint must match the webhook_url you configured for the Call Control app.
    """
    payload = await request.json()
    logger.info(f"TELNYX WEBHOOK EVENT: {payload}")

    try:
        data = payload.get("data") or {}
        event_type = data.get("event_type")
        event_payload = data.get("payload") or {}

        telnyx_session_id = event_payload.get("call_session_id")
        telnyx_call_control_id = event_payload.get("call_control_id")

        if not telnyx_session_id and not telnyx_call_control_id:
            logger.warning("Webhook missing call_session_id and call_control_id")
            return {"status": "ignored", "reason": "no ids"}

        calls_collection = db.get_db()["call_logs"]

        # Prefer matching on telnyx_session_id, fall back to telnyx_call_control_id
        query: Dict[str, Any] = {}
        if telnyx_session_id:
            query["telnyx_session_id"] = telnyx_session_id
        elif telnyx_call_control_id:
            query["telnyx_call_control_id"] = telnyx_call_control_id

        # Map Telnyx events to internal status strings
        status_map = {
            "call.initiated": "dialing",
            "call.ringing": "ringing",
            "call.answered": "active",
            "call.bridged": "active",
            "call.hangup": "ended",
            "call.ended": "ended",
            "call.failed": "failed",
        }

        new_status = status_map.get(event_type)
        if not new_status:
            logger.info(f"Unhandled Telnyx event_type: {event_type}")
            return {"status": "ignored", "event_type": event_type}

        update_doc: Dict[str, Any] = {
            "status": new_status,
            "updated_at": datetime.utcnow(),
        }

        # If terminal event, set ended_at if not already set
        if new_status in ("ended", "failed"):
            update_doc.setdefault("ended_at", datetime.utcnow())

        result = calls_collection.update_one(query, {"$set": update_doc})

        if result.matched_count == 0:
            logger.warning(
                f"No call_log found for telnyx_session_id={telnyx_session_id}, "
                f"telnyx_call_control_id={telnyx_call_control_id}"
            )

        # WebSocket broadcasting could be added here

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.get("/call-status/status/{call_id}")
async def get_call_status(call_id: str):
    """
    Return current call status for a given internal call_id.
    Used by the React dialer to poll call status.
    """
    calls_collection = db.get_db()["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")

    # Normalize Mongo ObjectId
    if "_id" in call_doc:
        call_doc["_id"] = str(call_doc["_id"])

    return {
        "call_id": call_doc.get("call_id"),
        "from_number": call_doc.get("from_number"),
        "to_number": call_doc.get("to_number"),
        "status": call_doc.get("status"),
        "started_at": call_doc.get("started_at"),
        "ended_at": call_doc.get("ended_at"),
    }


@router.get("/available-numbers")
async def get_available_numbers():
    """Fetch available phone numbers from Telnyx."""
    try:
        headers = get_telnyx_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{TELNYX_BASE_URL}/phone_numbers",
                headers=headers,
                params={"filter[status]": "active", "page[size]": 50},
            )

        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch numbers")

        body = response.json() if response.content else {}
        numbers = body.get("data") or []
        return {
            "numbers": [
                {"id": n.get("id"), "phone_number": n.get("phone_number")}
                for n in numbers
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching numbers: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch numbers: {str(e)}"
        )


@router.get("/settings")
async def get_telnyx_settings():
    """Get current Telnyx configuration."""
    try:
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
            "api_key": config.get("api_key", "")[:20] + "..."
            if config.get("api_key")
            else "",
            "connection_id": config.get("connection_id", ""),
            "webhook_url": config.get("webhook_url", TELNYX_WEBHOOK_BASE),
            "configured": bool(config.get("api_v2_key")),
        }
    except Exception as e:
        logger.error(f"Error fetching settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch settings")


@router.post("/settings")
async def update_telnyx_settings(settings: TelnyxSettings):
    """Update Telnyx configuration."""
    try:
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
        logger.info("Telnyx settings updated")
        return {"message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")


# --- Call recording endpoints ---


@router.post("/{call_id}/recording/start")
async def start_recording(call_id: str):
    db_instance = db.get_db()
    calls_collection = db_instance["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc or not call_doc.get("telnyx_call_control_id"):
        raise HTTPException(status_code=404, detail="Call not found")

    cc_id = call_doc["telnyx_call_control_id"]
    headers = get_telnyx_headers()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_BASE_URL}/calls/{cc_id}/actions/record_start",
            json={"channels": "single"},
            headers=headers,
        )
    if resp.status_code not in (200, 202):
        raise HTTPException(status_code=400, detail=resp.text)

    return {"status": "recording_started"}


@router.post("/{call_id}/recording/stop")
async def stop_recording(call_id: str):
    db_instance = db.get_db()
    calls_collection = db_instance["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc or not call_doc.get("telnyx_call_control_id"):
        raise HTTPException(status_code=404, detail="Call not found")

    cc_id = call_doc["telnyx_call_control_id"]
    headers = get_telnyx_headers()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_BASE_URL}/calls/{cc_id}/actions/record_stop",
            headers=headers,
        )
    if resp.status_code not in (200, 202):
        raise HTTPException(status_code=400, detail=resp.text)

    return {"status": "recording_stopped"}


# --- Call controls for UI: mute, hold, dtmf ---


@router.post("/{call_id}/mute")
async def mute_call(call_id: str):
    """
    Mute this call leg using its call_control_id.
    """
    db_instance = db.get_db()
    calls_collection = db_instance["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc or not call_doc.get("telnyx_call_control_id"):
        raise HTTPException(status_code=404, detail="Call not found")

    cc_id = call_doc["telnyx_call_control_id"]
    headers = get_telnyx_headers()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_BASE_URL}/calls/{cc_id}/actions/mute",
            headers=headers,
        )
    if resp.status_code not in (200, 202, 204):
        raise HTTPException(status_code=400, detail=resp.text)

    calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"muted": True}},
    )
    return {"status": "muted"}


@router.post("/{call_id}/hold")
async def hold_call(call_id: str):
    """
    Put call on hold.
    This example assumes you are using conferences and have stored conference_id.
    """
    db_instance = db.get_db()
    calls_collection = db_instance["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")

    conference_id = call_doc.get("conference_id")
    if not conference_id:
        raise HTTPException(
            status_code=400, detail="No conference associated with call for hold"
        )

    headers = get_telnyx_headers()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_BASE_URL}/conferences/{conference_id}/actions/hold",
            json={},
            headers=headers,
        )
    if resp.status_code not in (200, 202, 204):
        raise HTTPException(status_code=400, detail=resp.text)

    calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {"on_hold": True}},
    )
    return {"status": "on_hold"}


@router.post("/{call_id}/dtmf")
async def send_dtmf(call_id: str, body: DTMFRequest):
    """
    Send DTMF digits on this call using the Send DTMF Call Control command.
    """
    db_instance = db.get_db()
    calls_collection = db_instance["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    if not call_doc or not call_doc.get("telnyx_call_control_id"):
        raise HTTPException(status_code=404, detail="Call not found")

    cc_id = call_doc["telnyx_call_control_id"]
    headers = get_telnyx_headers()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{TELNYX_BASE_URL}/calls/{cc_id}/actions/send_dtmf",
            json={"digits": body.digit},
            headers=headers,
        )
    if resp.status_code not in (200, 202, 204):
        raise HTTPException(status_code=400, detail=resp.text)

    # Track sent DTMF locally (useful for UI buffers)
    calls_collection.update_one(
        {"call_id": call_id},
        {"$push": {"dtmf_buffer": body.digit}},
    )

    return {"status": "sent", "digit": body.digit}

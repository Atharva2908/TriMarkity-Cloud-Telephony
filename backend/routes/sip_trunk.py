# routes/sip_trunk.py - SIP TRUNKING (Bundle Minutes)
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
import httpx
from datetime import datetime, timedelta
import logging
import uuid
import os
from database import db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["sip"])

TELNYX_SIP_CONNECTION_ID = os.getenv("TELNYX_SIP_CONNECTION_ID")
TELNYX_SIP_DOMAIN = "sip.telnyx.com"

# ✅ Validate env
if not TELNYX_SIP_CONNECTION_ID:
    raise ValueError("TELNYX_SIP_CONNECTION_ID environment variable required")

class InitiateCallRequest(BaseModel):
    to_number: str
    from_number: Optional[str] = None

@router.post("/initiate")
async def initiate_sip_call(request: InitiateCallRequest):
    """✅ SIP TRUNK - Logs call for bundle minutes"""
    internal_call_id = str(uuid.uuid4())
    
    # Get default number
    numbers_collection = db.get_db()["call_numbers"]
    default_number_doc = numbers_collection.find_one({"is_default": True})
    from_number = request.from_number or (default_number_doc["number"] if default_number_doc else None)
    
    if not from_number:
        raise HTTPException(status_code=400, detail="No from_number provided")
    
    # Generate SIP URI
    sip_uri = f"sip:{request.to_number}@{TELNYX_SIP_DOMAIN}"
    
    # Log call
    call_doc = {
        "call_id": internal_call_id,
        "sip_connection_id": TELNYX_SIP_CONNECTION_ID,
        "from_number": from_number,
        "to_number": request.to_number,
        "direction": "outbound",
        "status": "sip_dialing",
        "sip_uri": sip_uri,
        "created_at": datetime.utcnow(),
    }
    
    calls_collection = db.get_db()["call_logs"]
    calls_collection.insert_one(call_doc)
    
    logger.info(f"📞 SIP CALL LOGGED: {from_number} → {request.to_number} | URI: {sip_uri}")
    
    return {
        "success": True,
        "call_id": internal_call_id,
        "status": "sip_ready",
        "from": from_number,
        "to": request.to_number,
        "sip_uri": sip_uri,
        "dial_instructions": f"Dial {sip_uri} in Zoiper/3CX using SIP Connection credentials"
    }

@router.post("/hangup/{call_id}")
async def sip_hangup(call_id: str):
    """✅ Clear SIP call session (Zoiper handles actual hangup)"""
    calls_collection = db.get_db()["call_logs"]
    
    result = calls_collection.update_one(
        {"call_id": call_id},
        {"$set": {
            "status": "completed",  # ✅ Frontend compatible
            "ended_at": datetime.utcnow()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Call not found")
    
    logger.info(f"📞 SIP SESSION ENDED: {call_id}")
    return {
        "success": True,
        "call_id": call_id,
        "status": "completed"  # ✅ React expects this
    }

@router.get("/status/{call_id}")
async def get_sip_status(call_id: str):
    """✅ React polling endpoint"""
    calls_collection = db.get_db()["call_logs"]
    call_doc = calls_collection.find_one({"call_id": call_id})
    
    if not call_doc:
        raise HTTPException(status_code=404, detail="Call not found")
    
    return {
        "call_id": call_id,
        "status": call_doc.get("status", "unknown"),
        "duration": call_doc.get("duration", 0),
        "has_recording": call_doc.get("has_recording", False),
        "is_recording": call_doc.get("is_recording", False),
        "direction": call_doc.get("direction", "outbound"),
        "to": call_doc.get("to_number"),
        "from": call_doc.get("from_number"),
        "sip_connection_id": call_doc.get("sip_connection_id"),
        "recording_url": call_doc.get("recording_url")
    }


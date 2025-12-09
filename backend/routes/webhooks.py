"""
Webhooks Module - Handles Telnyx call webhooks and analytics broadcasting
Receives call events from Telnyx and updates call logs + analytics in real-time
Downloads recordings to prevent URL expiration
"""

from fastapi import APIRouter, Request, BackgroundTasks
from database import db
from datetime import datetime
import logging
from models import CallStatus
from routes.analytics_ws import broadcast
import json
from typing import Optional
import requests
from pathlib import Path
import os

logger = logging.getLogger(__name__)
router = APIRouter()

# Recordings directory
RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", "./recordings"))
RECORDINGS_DIR.mkdir(exist_ok=True)

async def process_webhook_analytics(
    event_type: str,
    call_doc: dict,
    payload: dict,
    disposition: Optional[str] = None
):
    """
    Process analytics updates for webhook events
    Broadcasts real-time analytics deltas via WebSocket
    """
    try:
        now = datetime.utcnow()
        
        summary_delta = {
            "total_calls": 0,
            "completed": 0,
            "failed": 0,
            "busy": 0,
            "no_answer": 0,
        }
        daily_delta = {
            "date": now.date().isoformat(),
            "total": 0,
            "completed": 0,
            "failed": 0,
        }
        pattern_delta = {
            "hour": str(now.hour),
            "calls": 0,
        }
        disposition_delta = {
            "completed": 0,
            "failed": 0,
            "busy": 0,
            "no_answer": 0,
        }

        if event_type == "call.initiated":
            summary_delta["total_calls"] = 1
            daily_delta["total"] = 1
            pattern_delta["calls"] = 1
            
        elif event_type in ("call.ended", "call.hangup"):
            if not disposition:
                hangup_cause = payload.get("hangup_cause", "NORMAL_CLEARING")
                if hangup_cause in ["NORMAL_CLEARING", "ORIGINATOR_CANCEL"]:
                    disposition = "completed"
                elif hangup_cause == "USER_BUSY":
                    disposition = "busy"
                elif hangup_cause in ["NO_ANSWER", "NO_USER_RESPONSE"]:
                    disposition = "no_answer"
                else:
                    disposition = "failed"
            
            if disposition == "completed":
                summary_delta["completed"] = 1
                daily_delta["completed"] = 1
                disposition_delta["completed"] = 1
            elif disposition == "failed":
                summary_delta["failed"] = 1
                daily_delta["failed"] = 1
                disposition_delta["failed"] = 1
            elif disposition == "busy":
                summary_delta["busy"] = 1
                disposition_delta["busy"] = 1
            elif disposition == "no_answer":
                summary_delta["no_answer"] = 1
                disposition_delta["no_answer"] = 1

        if (
            any(v != 0 for v in summary_delta.values())
            or daily_delta["total"] != 0
            or daily_delta["completed"] != 0
            or daily_delta["failed"] != 0
            or pattern_delta["calls"] != 0
            or any(v != 0 for v in disposition_delta.values())
        ):
            await broadcast(
                json.dumps(
                    {
                        "type": "analytics_update",
                        "summary_delta": summary_delta,
                        "daily_delta": daily_delta,
                        "pattern_delta": pattern_delta,
                        "disposition_delta": disposition_delta,
                    }
                )
            )
            logger.info(f"📊 Analytics broadcast: {event_type}")
            
    except Exception as e:
        logger.error(f"❌ Analytics processing error: {str(e)}")

async def download_recording(recording_url: str, call_id: str) -> Optional[dict]:
    """
    Download recording from Telnyx to prevent URL expiration
    Returns dict with file_path and size, or None on failure
    """
    try:
        logger.info(f"⬇️ Downloading recording for call: {call_id}")
        
        response = requests.get(recording_url, timeout=60, stream=True)
        
        if response.status_code != 200:
            logger.error(f"❌ Failed to download recording: HTTP {response.status_code}")
            return None
        
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{call_id}_{timestamp}.mp3"
        filepath = RECORDINGS_DIR / filename
        
        file_size = 0
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    file_size += len(chunk)
        
        logger.info(f"✅ Recording downloaded: {filename} ({file_size} bytes)")
        
        return {
            "file_path": str(filepath),
            "filename": filename,
            "size": file_size
        }
        
    except Exception as e:
        logger.error(f"❌ Error downloading recording: {str(e)}", exc_info=True)
        return None

async def process_recording_saved(
    internal_call_id: str,
    telnyx_session_id: str,
    payload: dict,
    call_doc: dict
):
    """
    Process recording.saved webhook event
    Downloads recording file and saves metadata to MongoDB
    """
    try:
        db_instance = db.get_db()
        recordings_collection = db_instance["recordings"]
        calls_collection = db_instance["call_logs"]
        
        recording_urls = payload.get("recording_urls", {})
        public_recording_urls = payload.get("public_recording_urls", {})
        download_urls = payload.get("download_urls", {})
        
        telnyx_url = (
            public_recording_urls.get("mp3") or 
            download_urls.get("mp3") or
            recording_urls.get("mp3") or
            public_recording_urls.get("wav") or 
            download_urls.get("wav") or
            recording_urls.get("wav") or
            ""
        )
        
        if not telnyx_url:
            logger.error(f"❌ No recording URL found for call: {internal_call_id}")
            return False
        
        recording_id = payload.get("recording_id") or payload.get("id")
        recording_duration_ms = payload.get("duration_millis", 0)
        recording_duration = recording_duration_ms // 1000 if recording_duration_ms else 0
        recording_status = payload.get("status", "completed")
        
        to_number = call_doc.get("to_number", "Unknown")
        from_number = call_doc.get("from_number", "Unknown")
        call_duration = call_doc.get("duration", recording_duration)
        
        download_result = await download_recording(telnyx_url, internal_call_id)
        
        if download_result:
            local_url = f"/api/calls/recordings/download/{internal_call_id}"
            file_path = download_result["file_path"]
            file_size = download_result["size"]
            filename = download_result["filename"]
        else:
            logger.warning(f"⚠️ Download failed, storing Telnyx URL (will expire): {internal_call_id}")
            local_url = telnyx_url
            file_path = None
            file_size = payload.get("size", 0)
            filename = f"{internal_call_id}.mp3"
        
        recording_doc = {
            "call_id": internal_call_id,
            "recording_id": recording_id,
            "telnyx_session_id": telnyx_session_id,
            "url": local_url,
            "file_path": file_path,
            "filename": filename,
            "telnyx_url": telnyx_url,
            "size": file_size,
            "duration": recording_duration,
            "to_number": to_number,
            "from_number": from_number,
            "status": recording_status,
            "created_at": datetime.utcnow(),
            "telnyx_created_at": payload.get("created_at"),
            "channels": payload.get("channels"),
            "format": "mp3" if "mp3" in telnyx_url else "wav",
        }
        
        recordings_collection.update_one(
            {"call_id": internal_call_id},
            {"$set": recording_doc},
            upsert=True
        )
        
        calls_collection.update_one(
            {"call_id": internal_call_id},
            {
                "$set": {
                    "recording_url": local_url,
                    "recording_size": file_size,
                    "recording_duration": recording_duration,
                    "recording_id": recording_id,
                    "has_recording": True,
                    "recording_available": True,
                    "recording_saved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        
        logger.info(
            f"💾 Recording saved: {internal_call_id} | "
            f"Duration: {recording_duration}s | "
            f"Size: {file_size} bytes | "
            f"Downloaded: {file_path is not None}"
        )
        
        try:
            from main import get_call_manager
            manager = get_call_manager()
            await manager.broadcast({
                "type": "recording_added",
                "call_id": internal_call_id,
                "recording": {
                    "call_id": internal_call_id,
                    "url": local_url,
                    "duration": recording_duration,
                    "size": file_size,
                    "to_number": to_number,
                    "from_number": from_number,
                    "created_at": datetime.utcnow().isoformat()
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            logger.info(f"📡 Broadcast recording_added for: {internal_call_id}")
        except Exception as broadcast_err:
            logger.warning(f"⚠️ Failed to broadcast recording update: {broadcast_err}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error processing recording: {str(e)}", exc_info=True)
        return False

@router.post("/call")
async def handle_call_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook handler for Telnyx call events (API v2).
    Uses call_session_id or call_control_id to find internal call doc.
    Processes in background to avoid blocking Telnyx.
    """
    try:
        body = await request.json()
        data = body.get("data", {})
        event_type = data.get("event_type", "")
        payload = data.get("payload", {})
        
        telnyx_session_id = payload.get("call_session_id")
        telnyx_control_id = payload.get("call_control_id")
        
        if not telnyx_session_id and not telnyx_control_id:
            logger.warning(f"⚠️ Webhook without call identifiers: {event_type}")
            return {"status": "received", "warning": "no_call_id"}

        logger.info(f"📞 Webhook: {event_type} | Session: {telnyx_session_id} | Control: {telnyx_control_id}")

        db_instance = db.get_db()
        calls_collection = db_instance["call_logs"]

        call_doc = None
        if telnyx_session_id:
            call_doc = calls_collection.find_one({"telnyx_session_id": telnyx_session_id})
        if not call_doc and telnyx_control_id:
            call_doc = calls_collection.find_one({"telnyx_call_control_id": telnyx_control_id})

        webhooks_collection = db_instance["webhooks"]
        webhook_doc = {
            "telnyx_session_id": telnyx_session_id,
            "telnyx_control_id": telnyx_control_id,
            "event_type": event_type,
            "timestamp": datetime.utcnow(),
            "data": body,
        }

        if not call_doc:
            webhooks_collection.insert_one(webhook_doc)
            logger.warning(f"⚠️ Call not found for session {telnyx_session_id}")
            return {
                "status": "received",
                "event_type": event_type,
                "call_session_id": telnyx_session_id,
                "note": "call_not_tracked"
            }

        internal_call_id = call_doc["call_id"]
        webhook_doc["call_id"] = internal_call_id

        disposition = None
        
        if event_type == "call.initiated":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "status": CallStatus.DIALING,
                        "webhook_event": event_type,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"📱 Call initiated: {internal_call_id}")
            
            background_tasks.add_task(
                process_webhook_analytics,
                event_type,
                call_doc,
                payload
            )

        elif event_type == "call.answered":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "status": CallStatus.ACTIVE,
                        "webhook_event": event_type,
                        "answered_at": datetime.utcnow(),
                        "started_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"✅ Call answered: {internal_call_id}")

        elif event_type in ("call.ended", "call.hangup"):
            duration_millis = payload.get("duration_millis", 0)
            duration = duration_millis // 1000 if duration_millis else 0
            
            hangup_cause = payload.get("hangup_cause", "NORMAL_CLEARING")
            hangup_source = payload.get("hangup_source", "unknown")
            sip_code = payload.get("sip_hangup_cause", payload.get("sip_code", "200"))
            
            if hangup_cause in ["NORMAL_CLEARING", "ORIGINATOR_CANCEL"]:
                disposition = "completed"
            elif hangup_cause == "USER_BUSY":
                disposition = "busy"
            elif hangup_cause in ["NO_ANSWER", "NO_USER_RESPONSE"]:
                disposition = "no_answer"
            else:
                disposition = "failed"

            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "status": CallStatus.ENDED,
                        "webhook_event": event_type,
                        "duration": duration,
                        "ended_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "hangup_cause": hangup_cause,
                        "hangup_source": hangup_source,
                        "sip_code": sip_code,
                        "disposition": disposition,
                    }
                },
            )
            logger.info(f"📴 Call ended: {internal_call_id} | Duration: {duration}s | Disposition: {disposition}")
            
            background_tasks.add_task(
                process_webhook_analytics,
                event_type,
                call_doc,
                payload,
                disposition
            )

        elif event_type == "call.machine.detection.ended":
            detection_result = payload.get("result", "not_sure")
            is_machine = detection_result == "machine"
            
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "is_machine_detected": is_machine,
                        "machine_detection_result": detection_result,
                        "webhook_event": event_type,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"🤖 Machine detection: {internal_call_id} | Result: {detection_result}")

        elif event_type == "call.recording.saved":
            background_tasks.add_task(
                process_recording_saved,
                internal_call_id,
                telnyx_session_id,
                payload,
                call_doc
            )

        elif event_type == "call.recording.started":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "is_recording": True,
                        "recording_started_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"🔴 Recording started: {internal_call_id}")

        elif event_type == "call.speak.started":
            text = payload.get("text", "")
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "last_speak_text": text,
                        "webhook_event": event_type,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"🔊 Speak started: {internal_call_id}")

        webhooks_collection.insert_one(webhook_doc)

        return {
            "status": "received",
            "event_type": event_type,
            "call_id": internal_call_id,
            "call_session_id": telnyx_session_id,
            "disposition": disposition,
        }

    except Exception as e:
        logger.error(f"❌ Webhook error: {str(e)}", exc_info=True)
        
        try:
            db_instance = db.get_db()
            error_webhooks = db_instance["webhook_errors"]
            error_webhooks.insert_one({
                "timestamp": datetime.utcnow(),
                "error": str(e),
                "body": body if 'body' in locals() else None,
            })
        except:
            pass
        
        return {"status": "error", "message": str(e)}

@router.get("/health")
async def webhook_health():
    """Health check endpoint for webhooks"""
    return {
        "status": "healthy",
        "service": "webhooks",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/stats")
async def webhook_stats():
    """Get webhook statistics"""
    try:
        db_instance = db.get_db()
        webhooks_collection = db_instance["webhooks"]
        recordings_collection = db_instance["recordings"]
        
        pipeline = [
            {
                "$group": {
                    "_id": "$event_type",
                    "count": {"$sum": 1},
                    "last_received": {"$max": "$timestamp"}
                }
            },
            {"$sort": {"count": -1}}
        ]
        
        stats = list(webhooks_collection.aggregate(pipeline))
        total_webhooks = webhooks_collection.count_documents({})
        total_recordings = recordings_collection.count_documents({})
        
        recording_stats = recordings_collection.aggregate([
            {
                "$group": {
                    "_id": None,
                    "total_size": {"$sum": "$size"},
                    "total_duration": {"$sum": "$duration"},
                    "count": {"$sum": 1}
                }
            }
        ])
        
        recording_data = list(recording_stats)
        
        return {
            "total_webhooks": total_webhooks,
            "by_event_type": stats,
            "recordings": {
                "total": total_recordings,
                "total_size_bytes": recording_data[0]["total_size"] if recording_data else 0,
                "total_duration_seconds": recording_data[0]["total_duration"] if recording_data else 0,
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching webhook stats: {str(e)}")
        return {"error": str(e)}

@router.post("/test")
async def test_webhook():
    """Test endpoint to simulate webhook"""
    return {
        "status": "test_ok",
        "message": "Webhook endpoint is working",
        "timestamp": datetime.utcnow().isoformat()
    }

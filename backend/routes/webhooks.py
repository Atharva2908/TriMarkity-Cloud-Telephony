"""
Webhooks Module - Handles Telnyx call webhooks and analytics broadcasting
Receives call events from Telnyx and updates call logs + analytics in real-time
"""

from fastapi import APIRouter, Request, BackgroundTasks
from database import db
from datetime import datetime
import logging
from models import CallStatus
from routes.analytics_ws import broadcast  # WebSocket broadcaster for analytics
import json
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()


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
        
        # Initialize analytics deltas
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

        # Update analytics based on event type
        if event_type == "call.initiated":
            summary_delta["total_calls"] = 1
            daily_delta["total"] = 1
            pattern_delta["calls"] = 1
            
        elif event_type in ("call.ended", "call.hangup"):
            # Get disposition from call doc or determine from hangup cause
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
            
            # Update disposition deltas
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

        # Broadcast if there are meaningful changes
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
        
        # Get Telnyx identifiers - try both session_id and control_id
        telnyx_session_id = payload.get("call_session_id")
        telnyx_control_id = payload.get("call_control_id")
        
        if not telnyx_session_id and not telnyx_control_id:
            logger.warning(f"⚠️ Webhook without call identifiers: {event_type}")
            return {"status": "received", "warning": "no_call_id"}

        logger.info(f"📞 Webhook: {event_type} | Session: {telnyx_session_id} | Control: {telnyx_control_id}")

        db_instance = db.get_db()
        calls_collection = db_instance["call_logs"]

        # Find call by Telnyx session ID or control ID
        call_doc = None
        if telnyx_session_id:
            call_doc = calls_collection.find_one({"telnyx_session_id": telnyx_session_id})
        if not call_doc and telnyx_control_id:
            call_doc = calls_collection.find_one({"telnyx_call_control_id": telnyx_control_id})

        # Archive webhook even if call not found
        webhooks_collection = db_instance["webhooks"]
        webhook_doc = {
            "telnyx_session_id": telnyx_session_id,
            "telnyx_control_id": telnyx_control_id,
            "event_type": event_type,
            "timestamp": datetime.utcnow(),
            "data": body,
        }

        if not call_doc:
            # Not one of our tracked calls - archive and return
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

        # Update call based on event type
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
            
            # Process analytics in background
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
            
            # Determine disposition from hangup cause
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
            
            # Process analytics with disposition
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
            # Handle recording URLs - prefer public URLs
            recording_urls = payload.get("recording_urls", {})
            public_recording_urls = payload.get("public_recording_urls", {})
            
            recording_url = (
                public_recording_urls.get("mp3") or 
                public_recording_urls.get("wav") or
                recording_urls.get("mp3") or 
                recording_urls.get("wav")
            )
            
            recording_size = payload.get("size", 0)
            recording_duration = payload.get("duration_millis", 0) // 1000
            
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "recording_url": recording_url,
                        "recording_size": recording_size,
                        "recording_duration": recording_duration,
                        "has_recording": True,
                        "recording_saved_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

            # Store in recordings collection
            recordings_collection = db_instance["recordings"]
            recordings_collection.insert_one(
                {
                    "call_id": internal_call_id,
                    "telnyx_session_id": telnyx_session_id,
                    "url": recording_url,
                    "size": recording_size,
                    "duration": recording_duration,
                    "created_at": datetime.utcnow(),
                }
            )
            logger.info(f"💾 Recording saved: {internal_call_id} | Size: {recording_size} bytes")

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

        # Archive webhook
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
        
        # Archive error webhooks
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
        
        # Return 200 to prevent Telnyx retries for our internal errors
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
        
        # Get webhook counts by event type
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
        
        return {
            "total_webhooks": total_webhooks,
            "by_event_type": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching webhook stats: {str(e)}")
        return {"error": str(e)}

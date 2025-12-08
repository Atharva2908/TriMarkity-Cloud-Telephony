from fastapi import APIRouter, Request
from database import db
from datetime import datetime
import logging
from models import CallStatus
from routes.analytics_ws import broadcast  # import the WS broadcaster
import json

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/call")
async def handle_call_webhook(request: Request):
    """
    Webhook handler for Telnyx call events (API v2).
    Uses Telnyx call_session_id to find our internal call doc.
    """
    try:
        body = await request.json()
        event_type = body.get("data", {}).get("event_type", "")
        payload = body.get("data", {}).get("payload", {})

        telnyx_session_id = payload.get("call_session_id")
        if not telnyx_session_id:
            logger.warning("Webhook without call_session_id")
            return {"status": "received"}

        logger.info(f"Webhook received: {event_type} for session {telnyx_session_id}")

        db_instance = db.get_db()
        calls_collection = db_instance["call_logs"]

        # find our call by Telnyx session id
        call_doc = calls_collection.find_one({"telnyx_session_id": telnyx_session_id})
        if not call_doc:
            # not one of our tracked calls; just archive webhook
            webhooks_collection = db_instance["webhooks"]
            webhooks_collection.insert_one(
                {
                    "telnyx_session_id": telnyx_session_id,
                    "event_type": event_type,
                    "timestamp": datetime.utcnow(),
                    "data": body,
                }
            )
            return {
                "status": "received",
                "event_type": event_type,
                "call_session_id": telnyx_session_id,
            }

        internal_call_id = call_doc["call_id"]

        # Prepare analytics deltas (all zeros by default)
        summary_delta = {
            "total_calls": 0,
            "completed": 0,
            "failed": 0,
            "busy": 0,
            "no_answer": 0,
        }
        daily_delta = {
            "date": datetime.utcnow().date().isoformat(),
            "total": 0,
            "completed": 0,
            "failed": 0,
        }
        pattern_delta = {
            "hour": str(datetime.utcnow().hour),
            "calls": 0,
        }
        disposition_delta = {
            "completed": 0,
            "failed": 0,
            "busy": 0,
            "no_answer": 0,
        }

        # status updates
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
            logger.info(f"Call initiated: {internal_call_id}")

            # increment total for today + pattern
            summary_delta["total_calls"] = 1
            daily_delta["total"] = 1
            pattern_delta["calls"] = 1

        elif event_type == "call.answered":
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "status": CallStatus.ACTIVE,
                        "webhook_event": event_type,
                        "started_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"Call answered: {internal_call_id}")
            # no direct disposition delta yet; wait until ended

        elif event_type in ("call.ended", "call.hangup"):
            duration = payload.get("duration_millis", 0) // 1000
            disposition = call_doc.get("disposition")  # if you set it elsewhere

            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "status": CallStatus.ENDED,
                        "webhook_event": event_type,
                        "duration": duration,
                        "ended_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(f"Call ended: {internal_call_id}, duration: {duration}s")

            # Update daily / summary / disposition if you have a disposition value
            daily_delta["total"] = 0  # total_calls was already incremented at initiation
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

        elif event_type == "call.machine_detection_ended":
            is_machine = payload.get("detection_result") == "machine"
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "is_machine_detected": is_machine,
                        "webhook_event": event_type,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
            logger.info(
                f"Machine detection: {internal_call_id}, is_machine: {is_machine}"
            )

        elif event_type == "recording.finished":
            recording_url = payload.get("recording_url", "")
            recording_size = payload.get("size", 0)
            calls_collection.update_one(
                {"call_id": internal_call_id},
                {
                    "$set": {
                        "recording_url": recording_url,
                        "recording_size": recording_size,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

            recordings_collection = db_instance["recordings"]
            recordings_collection.insert_one(
                {
                    "call_id": internal_call_id,
                    "telnyx_session_id": telnyx_session_id,
                    "url": recording_url,
                    "size": recording_size,
                    "created_at": datetime.utcnow(),
                }
            )
            logger.info(
                f"Recording finished: {internal_call_id}, size: {recording_size}"
            )

        # archive every webhook
        webhooks_collection = db_instance["webhooks"]
        webhooks_collection.insert_one(
            {
                "call_id": internal_call_id,
                "telnyx_session_id": telnyx_session_id,
                "event_type": event_type,
                "timestamp": datetime.utcnow(),
                "data": body,
            }
        )

        # Send analytics update only when there is a meaningful change
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

        return {
            "status": "received",
            "event_type": event_type,
            "call_id": internal_call_id,
            "call_session_id": telnyx_session_id,
        }

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

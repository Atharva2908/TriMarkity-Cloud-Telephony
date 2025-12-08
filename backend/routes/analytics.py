from fastapi import APIRouter, HTTPException
from database import db
from datetime import datetime, timedelta

router = APIRouter()


@router.get("/summary")
async def get_analytics_summary():
    """Get overall call analytics summary"""
    calls_collection = db.get_db()["call_logs"]

    total_calls = calls_collection.count_documents({})

    completed = calls_collection.count_documents({"disposition": "completed"})
    failed = calls_collection.count_documents({"disposition": "failed"})
    busy = calls_collection.count_documents({"disposition": "busy"})
    no_answer = calls_collection.count_documents({"disposition": "no_answer"})

    calls = list(calls_collection.find({"duration": {"$gt": 0}}))
    avg_duration = (
        sum(call.get("duration", 0) for call in calls) / len(calls) if calls else 0
    )

    return {
        "total_calls": total_calls,
        "completed": completed,
        "failed": failed,
        "busy": busy,
        "no_answer": no_answer,
        "average_duration": int(avg_duration),
        "success_rate": (completed / total_calls * 100) if total_calls > 0 else 0,
    }


@router.get("/daily")
async def get_daily_analytics(days: int = 7):
    """Get daily call analytics for the past N days"""
    calls_collection = db.get_db()["call_logs"]

    daily_data = {}
    for i in range(days):
        date = (datetime.utcnow() - timedelta(days=i)).date()
        date_str = str(date)
        daily_data[date_str] = {"total": 0, "completed": 0, "failed": 0}

    calls = list(
        calls_collection.find(
            {"created_at": {"$gte": datetime.utcnow() - timedelta(days=days)}}
        )
    )

    for call in calls:
        created_at = call.get("created_at")
        if not created_at:
            continue
        date_str = str(created_at.date())
        if date_str in daily_data:
            daily_data[date_str]["total"] += 1
            if call.get("disposition") == "completed":
                daily_data[date_str]["completed"] += 1
            elif call.get("disposition") == "failed":
                daily_data[date_str]["failed"] += 1

    # list of { date, total, completed, failed } sorted by date
    result = [
        {"date": date_str, **stats}
        for date_str, stats in sorted(daily_data.items())
    ]
    return result


@router.get("/top-contacts")
async def get_top_contacts(limit: int = 10):
    """Get top N most called contacts"""
    calls_collection = db.get_db()["call_logs"]

    pipeline = [
        {"$group": {"_id": "$to_number", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]

    top_contacts = list(calls_collection.aggregate(pipeline))
    return {"top_contacts": top_contacts}


@router.get("/call-patterns")
async def get_call_patterns():
    """Get call patterns by hour of day"""
    calls_collection = db.get_db()["call_logs"]

    hourly_data = {str(i): 0 for i in range(24)}

    calls = list(calls_collection.find({}))
    for call in calls:
        created_at = call.get("created_at")
        hour = str(created_at.hour) if created_at else "0"
        if hour in hourly_data:
            hourly_data[hour] += 1

    return {
        "patterns": [{"hour": k, "calls": v} for k, v in sorted(hourly_data.items(), key=lambda x: int(x[0]))]
    }


@router.get("/disposition-breakdown")
async def get_disposition_breakdown():
    """Get breakdown of calls by disposition"""
    calls_collection = db.get_db()["call_logs"]

    return {
        "completed": calls_collection.count_documents({"disposition": "completed"}),
        "failed": calls_collection.count_documents({"disposition": "failed"}),
        "busy": calls_collection.count_documents({"disposition": "busy"}),
        "no_answer": calls_collection.count_documents({"disposition": "no_answer"}),
        "voicemail": calls_collection.count_documents({"disposition": "voicemail"}),
        "call_back": calls_collection.count_documents({"disposition": "call_back"}),
    }

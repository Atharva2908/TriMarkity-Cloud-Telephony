# routes/analytics_ws.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter()

# All connected analytics dashboard clients
active_connections: List[WebSocket] = []


async def connect_client(ws: WebSocket):
    """Accept a new WebSocket connection and track it."""
    await ws.accept()
    active_connections.append(ws)


def disconnect_client(ws: WebSocket):
    """Remove a WebSocket connection from the active list."""
    if ws in active_connections:
        active_connections.remove(ws)


async def broadcast(message: str):
    """
    Broadcast a JSON string to all connected analytics clients.

    Example payload from other routes:

    await broadcast(json.dumps({
        "type": "analytics_update",
        "summary_delta": {...},
        "daily_delta": {...},
        "pattern_delta": {...},
        "disposition_delta": {...},
    }))
    """
    for conn in list(active_connections):
        try:
            await conn.send_text(message)
        except Exception:
            # On error, drop the connection
            disconnect_client(conn)


@router.websocket("/ws/analytics")
async def analytics_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time analytics updates.
    Clients normally just connect and listen; the server pushes messages.
    """
    await connect_client(websocket)
    try:
        while True:
            # Keep the connection open; you can optionally handle messages/pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        disconnect_client(websocket)
    except Exception:
        disconnect_client(websocket)

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from database import db
import asyncio
from typing import Set
from datetime import datetime
import os
import importlib.util
import sys
from pathlib import Path
from routes import analytics_ws
from routes import webrtc 

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration from environment variables
APP_NAME = os.getenv("APP_NAME", "Telnyx Calling System")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


# WebSocket manager for real-time updates
class CallStatusManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.active_connections.discard(conn)


call_manager = CallStatusManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {APP_NAME}")
    logger.info(f"📊 Environment: {ENVIRONMENT}")
    yield
    logger.info("💤 Shutting down...")
    db.close()


app = FastAPI(
    title=APP_NAME,
    description="Telnyx-powered calling and CRM system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ORIGINS == ["*"] else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import core routes
try:
    from routes import (
        contacts,
        calls,
        admin,
        webhooks,
        auth,
        webrtc,
        outbound,
        numbers,
        analytics,
        recordings,
    )

    app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
    app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
    app.include_router(webrtc.router, prefix="/api/webrtc", tags=["webrtc"])
    app.include_router(outbound.router, prefix="/api/outbound", tags=["outbound"])
    app.include_router(numbers.router, prefix="/api/numbers", tags=["numbers"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
    app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
    app.include_router(analytics_ws.router, tags=["analytics-ws"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(recordings.router, prefix="/api/recordings", tags=["recordings"])
    app.include_router(webrtc.router, prefix="/api/webrtc", tags=["WebRTC"])
    logger.info("✅ Core routes loaded successfully")
except ImportError as e:
    logger.warning(f"⚠️  Some core routes not available: {e}")
except Exception as e:
    logger.error(f"❌ Error loading core routes: {e}")

# Import Telnyx integration with dynamic import (real integration)
try:
    telnyx_file = Path(__file__).parent / "routes" / "telnyx-integration.py"

    if telnyx_file.exists():
        spec = importlib.util.spec_from_file_location("telnyx-integration", telnyx_file)
        telnyx_module = importlib.util.module_from_spec(spec)
        sys.modules["telnyx_integration"] = telnyx_module
        spec.loader.exec_module(telnyx_module)

        app.include_router(telnyx_module.router, prefix="/api/telnyx", tags=["telnyx"])
        logger.info("✅ Telnyx integration loaded successfully")
    else:
        logger.warning("⚠️  telnyx-integration.py not found in routes folder")
except Exception as e:
    logger.error(f"❌ Error loading Telnyx integration: {e}")
    import traceback

    traceback.print_exc()

# NOTE: Removed old workflow/demo Telnyx routes (telnyx_api, call_status)

@app.websocket("/ws/calls")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time call updates"""
    await call_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data and "ping" in data.lower():
                await websocket.send_json(
                    {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
    except WebSocketDisconnect:
        await call_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await call_manager.disconnect(websocket)


@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        db_status = "connected" if db.get_db() else "disconnected"
    except Exception:
        db_status = "error"

    return {
        "status": "healthy",
        "app": APP_NAME,
        "environment": ENVIRONMENT,
        "database": db_status,
        "websocket_connections": len(call_manager.active_connections),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/api/status")
async def api_status():
    """API status endpoint with available routes"""
    return {
        "status": "online",
        "active_websockets": len(call_manager.active_connections),
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "websocket": "/ws/calls",
            "api": "/api",
        },
    }


def get_call_manager():
    """Dependency injection for call manager"""
    return call_manager


if __name__ == "__main__":
    import uvicorn

    # Use the port Render provides, fallback to 8000
    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=True if ENVIRONMENT == "development" else False,
    )

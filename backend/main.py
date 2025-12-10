from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse  # ✅ Changed this line
import logging
from database import db
from datetime import datetime
import os
import importlib.util
import sys
from pathlib import Path
from routes import analytics_ws
import httpx   # ✅ Add this if not present
import os      # ✅ Add this if not present

# ----------------------------
# Logging Setup
# ----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ----------------------------
# Configuration
# ----------------------------
APP_NAME = os.getenv("APP_NAME", "Telnyx Calling System")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# CORS Configuration
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://tri-markity-cloud-telephony.vercel.app,https://ctp.trimarkity.app"
).split(",")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS]

# ----------------------------
# WebSocket Manager
# ----------------------------
class CallStatusManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.add(connection)
        for conn in disconnected:
            self.active_connections.discard(conn)

call_manager = CallStatusManager()

# ----------------------------
# Lifespan
# ----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {APP_NAME}")
    logger.info(f"📊 Environment: {ENVIRONMENT}")
    logger.info(f"🌐 CORS Origins: {CORS_ORIGINS}")
    yield
    logger.info("💤 Shutting down...")
    db.close()

# ----------------------------
# FastAPI App
# ----------------------------
app = FastAPI(
    title=APP_NAME,
    description="Telnyx-powered calling and CRM system",
    version="1.0.0",
    lifespan=lifespan,
)

# ----------------------------
# CORS Middleware
# ----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Core Routes - FIXED PREFIXES ✅
# ----------------------------
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

    # ✅ All routers with consistent prefix pattern
    app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
    app.include_router(calls.router, prefix="/api/calls", tags=["calls"])
    app.include_router(webrtc.router, prefix="/api/webrtc", tags=["webrtc"])
    app.include_router(outbound.router, prefix="/api/outbound", tags=["outbound"])
    app.include_router(numbers.router, prefix="/api/numbers", tags=["numbers"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    
    # ✅ FIXED: Add prefix here, recordings.py has NO prefix
    app.include_router(recordings.router, prefix="/api/calls/recordings", tags=["recordings"])
    
    app.include_router(webhooks.router, prefix="", tags=["webhooks"])
    app.include_router(analytics_ws.router, tags=["analytics-ws"])
    
    logger.info("✅ Core routes loaded successfully")
    logger.info(f"✅ Recordings router registered at: /api/calls/recordings")
    logger.info(f"✅ WebRTC router registered at: /api/webrtc")
except ImportError as e:
    logger.warning(f"⚠️ Some core routes not available: {e}")
except Exception as e:
    logger.error(f"❌ Error loading core routes: {e}")
    import traceback
    traceback.print_exc()

# ----------------------------
# Telnyx Integration
# ----------------------------
try:
    telnyx_file = Path(__file__).parent / "routes" / "telnyx-integration.py"
    if telnyx_file.exists():
        spec = importlib.util.spec_from_file_location("telnyx_integration", telnyx_file)
        telnyx_module = importlib.util.module_from_spec(spec)
        sys.modules["telnyx_integration"] = telnyx_module
        spec.loader.exec_module(telnyx_module)
        app.include_router(telnyx_module.router, prefix="/api/telnyx", tags=["telnyx"])
        logger.info("✅ Telnyx integration loaded successfully")
    else:
        logger.warning("⚠️ telnyx-integration.py not found in routes folder")
except Exception as e:
    logger.error(f"❌ Error loading Telnyx integration: {e}")
    import traceback
    traceback.print_exc()

# ----------------------------
# WebSocket Endpoints
# ----------------------------

# ✅ Main WebSocket endpoint for call status updates
@app.websocket("/ws/calls")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket for real-time call status updates"""
    await call_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data and "ping" in data.lower():
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                })
    except WebSocketDisconnect:
        await call_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await call_manager.disconnect(websocket)

# ✅ Note: /api/webrtc/ws is handled by webrtc.router (in webrtc.py)
# This allows the call logs page to connect to its own WebSocket

# ----------------------------
# Health & Status Endpoints
# ----------------------------
@app.get("/health")
async def health():
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
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }

@app.get("/api/status")
async def api_status():
    """API status and available endpoints"""
    return {
        "status": "online",
        "active_websockets": len(call_manager.active_connections),
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "redoc": "/redoc",
            "websockets": {
                "main": "/ws/calls",
                "webrtc": "/api/webrtc/ws",
                "analytics": "/ws/analytics"
            },
            "api": {
                "contacts": "/api/contacts",
                "calls": "/api/calls",
                "call_logs": "/api/webrtc/logs",
                "recordings": "/api/calls/recordings/list",
                "webrtc": "/api/webrtc",
                "outbound": "/api/outbound",
                "numbers": "/api/numbers",
                "analytics": "/api/analytics",
                "admin": "/api/admin",
                "webhooks": "/api/webhooks/call",
            }
        },
    }

def get_call_manager():
    """Get the global call manager instance"""
    return call_manager

# ----------------------------
# Run Uvicorn (Render-compatible)
# ----------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=True if ENVIRONMENT == "development" else False,
    )

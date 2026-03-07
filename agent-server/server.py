"""
HTTP control server for the YouTube Bot.

POST /agent/join     { "room": "…" }                  — bot joins the room
POST /agent/leave    { "room": "…" }                  — bot leaves the room
POST /agent/stop     { "room": "…" }                  — stop playback (bot stays)
POST /agent/mode     { "room": "…", "mode": "…" }     — set mode: "audio" | "video"
POST /agent/quality  { "room": "…", "quality": "…" }   — set quality: "360p" | "480p" | "720p" | "1080p"
POST /agent/skip     { "room": "…" }                  — skip to next track
POST /agent/queue    { "room": "…", "url": "…" }      — add URL to queue
GET  /agent/status/<room>                             — full status JSON
GET  /health                                          — {"ok": true}
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Dict, Literal

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from agent import QUALITY_PRESETS, YouTubeAgent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_agents: Dict[str, YouTubeAgent] = {}

# Auth: AGENT_API_KEY — если задан, все запросы к /agent/* требуют заголовок X-API-Key
AGENT_API_KEY = os.getenv("AGENT_API_KEY", "").strip() or None

# Room limits
ROOM_MAX_LENGTH = int(os.getenv("AGENT_ROOM_MAX_LENGTH", "100"))

# Health: AGENT_HEALTH_SHOW_ROOMS — "true" для dev, "false" в production (не раскрывать rooms)
HEALTH_SHOW_ROOMS = os.getenv("AGENT_HEALTH_SHOW_ROOMS", "true").lower() in ("1", "true", "yes")

# Max concurrent agents
MAX_AGENTS = int(os.getenv("AGENT_MAX_AGENTS", "50"))


async def verify_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    """Verify API key if AGENT_API_KEY is configured."""
    if not AGENT_API_KEY:
        return
    if not x_api_key or x_api_key != AGENT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for agent in list(_agents.values()):
        try:
            await agent.disconnect()
        except Exception:
            logger.exception("Error disconnecting agent during shutdown")


app = FastAPI(title="YouTube Bot Server", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: AGENT_CORS_ORIGINS — через запятую, например "https://app.example.com,http://localhost:1420". Пусто или не задано = "*"
_cors_origins_raw = os.getenv("AGENT_CORS_ORIGINS", "").strip()
CORS_ORIGINS = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()] if _cors_origins_raw else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ────────────────────────────────────────────────────────────
class RoomRequest(BaseModel):
    room: str

    @field_validator("room")
    @classmethod
    def validate_room(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("room must not be empty")
        if len(v) > ROOM_MAX_LENGTH:
            raise ValueError(f"room must be at most {ROOM_MAX_LENGTH} characters")
        return v


class ModeRequest(BaseModel):
    room: str
    mode: Literal["audio", "video"]

    @field_validator("room")
    @classmethod
    def validate_room(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("room must not be empty")
        if len(v) > ROOM_MAX_LENGTH:
            raise ValueError(f"room must be at most {ROOM_MAX_LENGTH} characters")
        return v


class QueueRequest(BaseModel):
    room: str
    url: str

    @field_validator("room")
    @classmethod
    def validate_room(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("room must not be empty")
        if len(v) > ROOM_MAX_LENGTH:
            raise ValueError(f"room must be at most {ROOM_MAX_LENGTH} characters")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("url must not be empty")
        return v


class QualityRequest(BaseModel):
    room: str
    quality: str

    @field_validator("room")
    @classmethod
    def validate_room(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("room must not be empty")
        if len(v) > ROOM_MAX_LENGTH:
            raise ValueError(f"room must be at most {ROOM_MAX_LENGTH} characters")
        return v

    @field_validator("quality")
    @classmethod
    def validate_quality(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in QUALITY_PRESETS:
            raise ValueError(f"quality must be one of: {', '.join(QUALITY_PRESETS)}")
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/agent/join", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def agent_join(request: Request, req: RoomRequest):
    room = req.room
    if room in _agents:
        return {"status": "already_in_room", "room": room}
    if len(_agents) >= MAX_AGENTS:
        raise HTTPException(status_code=503, detail="Maximum number of agents reached")

    def on_agent_disconnect():
        _agents.pop(room, None)
        logger.info("Bot auto-left room '%s' (was alone)", room)

    agent = YouTubeAgent(room, on_disconnect=on_agent_disconnect)
    try:
        await agent.connect()
    except Exception as exc:
        logger.exception("Failed to connect bot to room '%s'", room)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    _agents[room] = agent
    logger.info("Bot joined room '%s'", room)
    return {"status": "joined", "room": room}


@app.post("/agent/leave", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def agent_leave(request: Request, req: RoomRequest):
    room = req.room
    agent = _agents.pop(room, None)
    if not agent:
        return {"status": "not_in_room", "room": room}
    try:
        await agent.disconnect()
    except Exception:
        logger.exception("Error while disconnecting bot from room '%s'", room)
    logger.info("Bot left room '%s'", room)
    return {"status": "left", "room": room}


@app.post("/agent/stop", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def agent_stop(request: Request, req: RoomRequest):
    """Stop current playback without disconnecting the bot."""
    room = req.room
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    await agent.stop()
    return {"status": "stopped", "room": room}


@app.post("/agent/mode", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def agent_set_mode(request: Request, req: ModeRequest):
    """Switch streaming mode. Takes effect on the next play command."""
    room = req.room
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    agent.set_mode(req.mode)
    return {"status": "ok", "room": room, "mode": req.mode}


@app.post("/agent/quality", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def agent_set_quality(request: Request, req: QualityRequest):
    """Switch video quality. Takes effect on the next play command."""
    room = req.room
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    agent.set_quality(req.quality)
    return {"status": "ok", "room": room, "quality": req.quality}


@app.post("/agent/skip", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def agent_skip(request: Request, req: RoomRequest):
    """Skip current track, play next from queue."""
    room = req.room
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    await agent.skip()
    return {"status": "ok", "room": room}


@app.post("/agent/queue", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def agent_queue_add(request: Request, req: QueueRequest):
    """Add URL to queue."""
    room = req.room
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    await agent.queue_add(req.url)
    return {"status": "ok", "room": room, "queue_length": len(agent.queue)}


@app.get("/agent/status/{room}", dependencies=[Depends(verify_api_key)])
@limiter.limit("120/minute")
async def agent_status(
    request: Request,
    room: str = Path(..., max_length=ROOM_MAX_LENGTH),
):
    agent = _agents.get(room)
    if not agent:
        return {"active": False}
    return {
        "active": True,
        "mode": agent.mode,
        "quality": agent.quality,
        "playing": agent.is_playing,
        "title": agent.current_title,
        "url": agent.current_url,
        "queue": agent.queue,
        "queue_display": agent.queue_display(),
        "queue_length": len(agent.queue),
    }


@app.get("/health")
async def health():
    resp = {"ok": True}
    if HEALTH_SHOW_ROOMS:
        resp["rooms"] = list(_agents.keys())
    return resp


if __name__ == "__main__":
    port = int(os.getenv("AGENT_PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

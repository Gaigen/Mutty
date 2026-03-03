"""
HTTP control server for the YouTube Bot.

POST /agent/join   { "room": "…" }              — bot joins the room
POST /agent/leave  { "room": "…" }              — bot leaves the room
POST /agent/stop   { "room": "…" }              — stop playback (bot stays)
POST /agent/mode   { "room": "…", "mode": "…" } — set mode: "audio" | "video"
GET  /agent/status/<room>                       — full status JSON
GET  /health                                    — {"ok": true}
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Dict, Literal

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from agent import YouTubeAgent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_agents: Dict[str, YouTubeAgent] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for agent in list(_agents.values()):
        try:
            await agent.disconnect()
        except Exception:
            pass


app = FastAPI(title="YouTube Bot Server", lifespan=lifespan)

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


class ModeRequest(BaseModel):
    room: str
    mode: Literal["audio", "video"]

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("audio", "video"):
            raise ValueError("mode must be 'audio' or 'video'")
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/agent/join")
async def agent_join(req: RoomRequest):
    room = req.room.strip()
    if not room:
        raise HTTPException(status_code=422, detail="room must not be empty")
    if room in _agents:
        return {"status": "already_in_room", "room": room}

    agent = YouTubeAgent(room)
    try:
        await agent.connect()
    except Exception as exc:
        logger.exception("Failed to connect bot to room '%s'", room)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    _agents[room] = agent
    logger.info("Bot joined room '%s'", room)
    return {"status": "joined", "room": room}


@app.post("/agent/leave")
async def agent_leave(req: RoomRequest):
    room = req.room.strip()
    agent = _agents.pop(room, None)
    if not agent:
        return {"status": "not_in_room", "room": room}
    try:
        await agent.disconnect()
    except Exception:
        logger.exception("Error while disconnecting bot from room '%s'", room)
    logger.info("Bot left room '%s'", room)
    return {"status": "left", "room": room}


@app.post("/agent/stop")
async def agent_stop(req: RoomRequest):
    """Stop current playback without disconnecting the bot."""
    room = req.room.strip()
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    await agent.stop()
    return {"status": "stopped", "room": room}


@app.post("/agent/mode")
async def agent_set_mode(req: ModeRequest):
    """Switch streaming mode. Takes effect on the next play command."""
    room = req.room.strip()
    agent = _agents.get(room)
    if not agent:
        return {"status": "not_in_room", "room": room}
    agent.set_mode(req.mode)
    return {"status": "ok", "room": room, "mode": req.mode}


@app.get("/agent/status/{room}")
async def agent_status(room: str):
    agent = _agents.get(room)
    if not agent:
        return {"active": False}
    return {
        "active": True,
        "mode": agent.mode,
        "playing": agent.is_playing,
        "title": agent.current_title,
        "url": agent.current_url,
    }


@app.get("/health")
async def health():
    return {"ok": True, "rooms": list(_agents.keys())}


if __name__ == "__main__":
    port = int(os.getenv("AGENT_PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)

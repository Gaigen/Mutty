"""Core agent — orchestrates chat, media, and AI plugins."""

import asyncio
import json
import logging
from typing import Callable, Optional

from livekit import rtc

from ..chat import gateway as chat_gateway
from ..chat.parser import parse, Command
from ..media.manager import PlaybackManager
from ..ai.chat import AIChatManager
from ..memory import MemoryStore
from ..config import BOT_IDENTITY

logger = logging.getLogger(__name__)


class Agent:
    """LiveKit agent that wires chat, media playback, and AI together."""

    def __init__(
        self,
        room: rtc.Room,
        on_shutdown: Optional[Callable[[], None]] = None,
        llm=None,
        memory: Optional[MemoryStore] = None,
    ) -> None:
        self.room = room
        self.room_name = room.name
        self._on_shutdown_cb = on_shutdown
        self._memory = memory

        self._chat = chat_gateway.ChatGateway(room)
        self._media = PlaybackManager(
            room,
            chat_send=self._chat.send,
            on_status_change=self._update_status,
        )
        self._ai = AIChatManager(
            llm=llm,
            chat_send=self._chat.send,
            memory=memory,
        )

        self._command_lock = asyncio.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    def setup(self) -> None:
        self.room.on("data_received", self._on_data)
        self.room.on("participant_disconnected", self._on_participant_disconnected)
        logger.info("[Agent] Connected to room '%s'", self.room_name)

    async def run(self) -> None:
        await self._chat.welcome()
        await self._update_status()

    async def shutdown(self) -> None:
        await self._media.shutdown()
        await self._chat.goodbye()
        if self._memory:
            self._memory.drop_room(self.room_name)
        logger.info("[Agent] Disconnected from room '%s'", self.room_name)
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    # ── Status ────────────────────────────────────────────────────────────────
    def _status_dict(self) -> dict:
        return {"active": True, **self._media.status()}

    async def _update_status(self) -> None:
        if self.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            return
        try:
            await self.room.local_participant.set_attributes(
                {"bot:status": json.dumps(self._status_dict())}
            )
        except Exception as exc:
            logger.warning("[Agent] Failed to update status: %s", exc)

    # ── Chat message from text stream (livekit-agents v1.5+) ───────────────
    def _on_chat_message(self, text: str, participant_identity: str) -> None:
        """Handle chat messages arriving via text streams."""
        try:
            if participant_identity == BOT_IDENTITY:
                return

            stripped = text.strip()
            if not stripped:
                return

            # Persist to memory
            if self._memory:
                self._memory.add_history(self.room_name, "user", stripped, participant_identity)

            cmd = parse(stripped)
            if cmd:
                asyncio.ensure_future(self._dispatch(cmd))
            elif self._ai:
                asyncio.ensure_future(self._ai.chat(stripped, self.room_name))
        except Exception:
            logger.exception("[Agent] Error in _on_chat_message")

    # ── Event handlers ────────────────────────────────────────────────────────
    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        if len(self.room.remote_participants) == 0:
            logger.info("[Agent] Alone in room '%s', shutting down", self.room_name)
            asyncio.ensure_future(self._request_shutdown())

    async def _request_shutdown(self) -> None:
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    def _on_data(self, dp: rtc.DataPacket) -> None:
        try:
            # Bot ignores itself
            if dp.participant is not None and getattr(dp.participant, "identity", None) == BOT_IDENTITY:
                return

            # Control commands come via a dedicated topic
            topic = (dp.topic or "") if hasattr(dp, "topic") else ""
            if topic == "agent-control":
                try:
                    obj = json.loads(dp.data.decode("utf-8"))
                    if isinstance(obj, dict):
                        asyncio.ensure_future(self.handle_control(obj))
                except Exception:
                    logger.warning("[Agent] Invalid control payload")
                return

            text = dp.data.decode("utf-8")
            try:
                obj = json.loads(text)
                if isinstance(obj, dict):
                    text = obj.get("message", text)
            except (json.JSONDecodeError, TypeError):
                pass

            stripped = text.strip()
            identity = getattr(dp.participant, "identity", None) if dp.participant else None

            # Persist to memory
            if self._memory:
                self._memory.add_history(self.room_name, "user", stripped, identity)

            cmd = parse(stripped)
            if cmd:
                asyncio.ensure_future(self._dispatch(cmd))
            elif self._ai:
                # Fallback: treat unrecognized as AI chat
                asyncio.ensure_future(self._ai.chat(stripped, self.room_name))
        except Exception:
            logger.exception("[Agent] Error in _on_data")

    # ── Command dispatch ──────────────────────────────────────────────────────
    async def _dispatch(self, cmd: Command) -> None:
        async with self._command_lock:
            if cmd.action == "stop":
                await self._media.stop()
            elif cmd.action == "skip":
                await self._media.skip()
            elif cmd.action == "play":
                if cmd.mode:
                    self._media.set_mode(cmd.mode)
                await self._media.play(cmd.url)
            elif cmd.action == "search_play":
                if cmd.mode:
                    self._media.set_mode(cmd.mode)
                await self._media.search_and_play(
                    "youtube" if cmd.mode == "video" else "soundcloud", cmd.query
                )
            elif cmd.action == "queue_add":
                await self._media.queue_add(cmd.url)
            elif cmd.action == "queue_list":
                await self._media.queue_show()
            elif cmd.action == "queue_clear":
                await self._media.queue_clear()
            elif cmd.action == "queue_shuffle":
                await self._media.queue_shuffle()
            elif cmd.action == "ai_chat":
                await self._ai.chat(cmd.query, self.room_name)
            elif cmd.action == "ai_playlist":
                tracks = await self._ai.playlist(cmd.query, self.room_name)
                for track in tracks:
                    await self._media.queue_add(f"ytsearch1:{track}")

    # ── Control channel (JSON) ────────────────────────────────────────────────
    async def handle_control(self, obj: dict) -> None:
        cmd = obj.get("cmd")
        if not cmd:
            return
        if cmd == "leave":
            asyncio.ensure_future(self._request_shutdown())
        elif cmd == "stop":
            asyncio.ensure_future(self._run_safely(self._media.stop))
        elif cmd == "skip":
            asyncio.ensure_future(self._run_safely(self._media.skip))
        elif cmd == "mode":
            m = obj.get("mode")
            if m in ("audio", "video"):
                self._media.set_mode(m)
                asyncio.ensure_future(self._run_safely(self._update_status))
        elif cmd == "quality":
            q = obj.get("quality")
            if q:
                self._media.set_quality(q)
                asyncio.ensure_future(self._run_safely(self._update_status))
        elif cmd == "queue":
            url = obj.get("url", "").strip()
            if url:
                asyncio.ensure_future(self._run_safely(lambda: self._media.queue_add(url)))
        elif cmd == "pause":
            asyncio.ensure_future(self._run_safely(self._media.pause))
        elif cmd == "resume":
            asyncio.ensure_future(self._run_safely(self._media.resume))
        elif cmd == "repeat":
            self._media.set_repeat(bool(obj.get("repeat", True)))
            asyncio.ensure_future(self._run_safely(self._update_status))
        elif cmd == "clear":
            asyncio.ensure_future(self._run_safely(self._media.queue_clear))
        elif cmd == "shuffle":
            asyncio.ensure_future(self._run_safely(self._media.queue_shuffle))

    async def _run_safely(self, coro_fn) -> None:
        async with self._command_lock:
            try:
                await coro_fn()
            except Exception:
                logger.exception("[Agent] Command error")

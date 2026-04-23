"""Main bot orchestrator — thin controller wiring chat, queue, and streaming."""

import asyncio
import json
import logging
import os
import time
from typing import Callable, Optional

from livekit import rtc

from . import chat, media
from .config import (
    AGENT_CONTROL_TOPIC,
    BOT_IDENTITY,
    DEFAULT_QUALITY,
    classify_source,
    is_audio_only_source,
    is_url_safe_for_media,
)
from .llm.base import LLMProvider
from .memory import MemoryStore

logger = logging.getLogger(__name__)


class Bot:
    def __init__(
        self,
        room: rtc.Room,
        on_shutdown: Optional[Callable[[], None]] = None,
        llm: Optional[LLMProvider] = None,
        memory: Optional[MemoryStore] = None,
    ) -> None:
        self.room = room
        self.room_name = room.name
        self._on_shutdown_cb = on_shutdown
        self._llm = llm
        self._memory = memory

        self._mode = "video"
        self._quality = DEFAULT_QUALITY
        self._paused = False
        self._repeat = False
        self._pause_position = 0.0
        self._stream_start_time = 0.0

        self._current_url: Optional[str] = None
        self._current_title: Optional[str] = None

        self._chat = chat.ChatGateway(room)
        self._queue = media.PlaybackQueue()
        self._streamer = media.MediaStreamer(room)

        self._command_lock = asyncio.Lock()
        self._watch_task: Optional[asyncio.Task] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    def setup(self) -> None:
        self.room.on("data_received", self._on_data)
        self.room.on("participant_disconnected", self._on_participant_disconnected)
        logger.info("[Bot] Connected to room '%s'", self.room_name)

    async def run(self) -> None:
        await self._chat.welcome()
        await self._update_status()

    async def shutdown(self) -> None:
        if self._watch_task and not self._watch_task.done():
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
        await self._streamer.stop()
        await self._streamer.unpublish_audio()
        await self._streamer.unpublish_video()
        await self._chat.goodbye()
        if self._memory:
            self._memory.drop_room(self.room_name)
        logger.info("[Bot] Disconnected from room '%s'", self.room_name)
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    # ── Status attributes ─────────────────────────────────────────────────────
    def _status_dict(self) -> dict:
        display_url: Optional[str] = None
        if self._current_url:
            meta = self._queue.get_meta(self._current_url)
            if meta:
                _, link = meta
                if link and link.startswith("http"):
                    display_url = link
            if not display_url and self._current_url.startswith("http"):
                display_url = self._current_url
        return {
            "active": True,
            "mode": self._mode,
            "quality": self._quality,
            "playing": self.is_playing,
            "paused": self._paused,
            "repeat": self._repeat,
            "title": self._current_title,
            "url": display_url,
            "queue_length": self._queue.length,
            "queue_display": self._queue.display(),
        }

    async def _update_status(self) -> None:
        if self.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            return
        try:
            await self.room.local_participant.set_attributes(
                {"bot:status": json.dumps(self._status_dict())}
            )
        except Exception as exc:
            logger.warning("[Bot] Failed to update status: %s", exc)

    # ── Playback helpers ──────────────────────────────────────────────────────
    @property
    def is_playing(self) -> bool:
        return self._current_url is not None and not self._paused

    async def play(self, url: str) -> None:
        if not is_url_safe_for_media(url):
            await self._chat.send("❌ Invalid link (SSRF protection).")
            return
        await self._stop_current()
        await self._start(url)

    async def stop(self) -> None:
        self._paused = False
        self._queue.clear()
        await self._stop_current()
        self._current_url = None
        self._current_title = None
        await self._streamer.unpublish_video()
        await self._chat.send("⏹ Playback stopped.")
        await self._update_status()

    async def skip(self) -> None:
        self._paused = False
        await self._stop_current()
        self._current_url = None
        self._current_title = None
        await self._play_next()
        await self._update_status()

    async def pause(self) -> None:
        if not self._current_url or self._paused:
            return
        self._pause_position = time.monotonic() - self._stream_start_time
        self._paused = True
        await self._stop_current()
        await self._chat.send("⏸ Paused.")
        await self._update_status()

    async def resume(self) -> None:
        if not self._current_url or not self._paused:
            return
        self._paused = False
        seek = max(0.0, self._pause_position)
        await self._stop_current()
        await self._start(self._current_url, seek_seconds=seek)
        await self._chat.send("▶ Resuming.")
        await self._update_status()

    def set_mode(self, mode: str) -> None:
        if mode in ("audio", "video") and self._mode != mode:
            self._mode = mode
            logger.info("[Bot] Mode -> '%s'", mode)

    def set_quality(self, quality: str) -> None:
        if quality != self._quality:
            self._quality = quality
            self._streamer.set_quality(quality)
            logger.info("[Bot] Quality -> '%s'", quality)

    def set_repeat(self, repeat: bool) -> None:
        self._repeat = repeat
        logger.info("[Bot] Repeat -> %s", repeat)

    # ── Queue commands ────────────────────────────────────────────────────────
    async def queue_add(self, raw: str) -> None:
        url = raw.strip()
        if not url:
            return
        if url.lower().startswith("youtube ") or url.lower().startswith("yt "):
            url = f"ytsearch1:{url.split(maxsplit=1)[1]}"
        elif url.lower().startswith("soundcloud ") or url.lower().startswith("sc "):
            url = f"scsearch1:{url.split(maxsplit=1)[1]}"
        if not is_url_safe_for_media(url):
            await self._chat.send("❌ Invalid link (SSRF protection).")
            return
        self._queue.add(url)
        asyncio.create_task(self._resolve_meta(url))
        display = url[:60] + ("…" if len(url) > 60 else "")
        await self._chat.send(f"➕ Queued ({self._queue.length}): {display}")
        await self._update_status()
        if not self.is_playing:
            await self._play_next()

    async def _resolve_meta(self, url: str) -> None:
        try:
            _, _, title, webpage_url = await media.resolve(url)
            self._queue.cache_meta(url, title or url, webpage_url or url)
        except Exception:
            pass

    async def queue_clear(self) -> None:
        n = self._queue.clear()
        await self._chat.send(f"🗑 Queue cleared ({n} tracks).")
        await self._update_status()

    async def queue_shuffle(self) -> None:
        if not self._queue.shuffle():
            await self._chat.send("🔀 Queue too short to shuffle.")
            return
        await self._chat.send(f"🔀 Queue shuffled ({self._queue.length} tracks).")
        await self._update_status()

    async def queue_show(self) -> None:
        if self._queue.is_empty():
            await self._chat.send("📋 Queue is empty.")
            return
        lines = [f"📋 Queue ({self._queue.length}):"]
        for i, u in enumerate(self._queue.items[:8], 1):
            lines.append(self._queue.format_line(i, u))
        if self._queue.length > 8:
            lines.append(f"  … +{self._queue.length - 8}")
        await self._chat.send("\n".join(lines))

    # ── Internal playback ─────────────────────────────────────────────────────
    async def _start(self, url: str, seek_seconds: float = 0.0) -> None:
        self._stream_start_time = time.monotonic() - seek_seconds
        src = classify_source(url)
        pretty = {"youtube": "YouTube", "twitch": "Twitch", "soundcloud": "SoundCloud", "telegram": "Telegram"}.get(src, "other")
        label = "🎵 audio" if self._mode == "audio" else "🎬 video"
        await self._chat.send(f"⏳ Loading [{label}, {pretty}]: {url[:60]}{'…' if len(url) > 60 else ''}")

        try:
            video_url, audio_url, title, webpage_url = await media.resolve(url)
        except Exception as exc:
            await self._chat.send(f"❌ Resolve error: {exc}")
            self._current_url = None
            self._current_title = None
            await self._play_next()
            return

        self._queue.cache_meta(url, title or url, webpage_url or url)
        self._current_url = url
        self._current_title = title

        has_video = self._mode == "video" and not is_audio_only_source(src)
        await self._streamer.ensure_audio()
        if has_video:
            await self._streamer.ensure_video()
        else:
            await self._streamer.unpublish_video()

        if has_video:
            # Use combined A+V on POSIX for sync; separate on Windows.
            if os.name == "posix":
                await self._streamer.start_av_combined(video_url, audio_url, seek_seconds)
            else:
                await self._streamer.start_av_separate(video_url, audio_url, seek_seconds)
        else:
            await self._streamer.start_audio_only(audio_url, seek_seconds)

        self._watch_task = asyncio.create_task(self._watch_stream())
        icon = "🎵" if self._mode == "audio" else "🎬"
        await self._chat.send(f"{icon} Now playing: {title or url}")
        await self._update_status()

    async def _stop_current(self) -> None:
        if self._watch_task and not self._watch_task.done():
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
            self._watch_task = None
        await self._streamer.stop()

    async def _play_next(self) -> None:
        if self._paused:
            return
        if self._repeat and self._current_url:
            self._queue.add_front(self._current_url)
        url = self._queue.pop_next()
        if url is None:
            self._current_url = None
            self._current_title = None
            await self._streamer.unpublish_audio()
            await self._streamer.unpublish_video()
            await self._chat.send("✅ Playback finished.")
            await self._update_status()
            return
        await self._start(url)

    async def _watch_stream(self) -> None:
        """Wait for the current stream task(s) to finish, then play next."""
        tasks: list[asyncio.Task] = []
        if self._streamer.audio_task:
            tasks.append(self._streamer.audio_task)
        if self._streamer.video_task:
            tasks.append(self._streamer.video_task)
        if not tasks:
            return
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            return
        except Exception:
            logger.exception("[Bot] Stream watcher error")
        # Stream ended naturally → next track
        await self._play_next()

    # ── Search ────────────────────────────────────────────────────────────────
    async def search_and_play(self, source: str, query: str) -> None:
        query = query.strip()
        if not query:
            return
        if source == "youtube":
            url = f"ytsearch1:{query}"
            await self._chat.send(f"🔍 Searching YouTube: {query}")
        elif source == "soundcloud":
            url = f"scsearch1:{query}"
            await self._chat.send(f"🔍 Searching SoundCloud: {query}")
        else:
            await self._chat.send("❌ Search supported only for YouTube and SoundCloud.")
            return
        try:
            await self.play(url)
        except Exception as exc:
            await self._chat.send(f"❌ Search error: {exc}")

    # ── Event handlers ────────────────────────────────────────────────────────
    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        if len(self.room.remote_participants) == 0:
            logger.info("[Bot] Alone in room '%s', shutting down", self.room_name)
            asyncio.ensure_future(self._request_shutdown())

    async def _request_shutdown(self) -> None:
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    def _on_data(self, dp: rtc.DataPacket) -> None:
        try:
            topic = (dp.topic or "") if hasattr(dp, "topic") else ""
            if topic == AGENT_CONTROL_TOPIC:
                self._handle_control(dp)
                return

            # Ignore bot's own chat messages
            if dp.participant is not None and getattr(dp.participant, "identity", None) == BOT_IDENTITY:
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

            # Save to persistent memory
            if self._memory:
                self._memory.add_history(self.room_name, "user", stripped, identity)

            cmd = chat.parse(stripped)
            if cmd:
                asyncio.ensure_future(self._run_chat_command(cmd))
            elif self._llm:
                # Fallback: treat unrecognized messages as AI chat
                asyncio.ensure_future(self._ai_chat(stripped))
        except Exception:
            logger.exception("[Bot] Error in _on_data")

    async def _run_chat_command(self, cmd: chat.Command) -> None:
        async with self._command_lock:
            if cmd.action == "stop":
                await self.stop()
            elif cmd.action == "skip":
                await self.skip()
            elif cmd.action == "play":
                if cmd.mode:
                    self.set_mode(cmd.mode)
                await self.play(cmd.url)
            elif cmd.action == "search_play":
                if cmd.mode:
                    self.set_mode(cmd.mode)
                await self.search_and_play("youtube" if cmd.mode == "video" else "soundcloud", cmd.query)
            elif cmd.action == "queue_add":
                await self.queue_add(cmd.url)
            elif cmd.action == "queue_list":
                await self.queue_show()
            elif cmd.action == "queue_clear":
                await self.queue_clear()
            elif cmd.action == "queue_shuffle":
                await self.queue_shuffle()
            elif cmd.action == "ai_chat":
                await self._ai_chat(cmd.query)
            elif cmd.action == "ai_playlist":
                await self._ai_playlist(cmd.query)

    # ── AI features ───────────────────────────────────────────────────────────
    async def _ai_chat(self, message: str) -> None:
        """AI assistant — answers questions OR searches/plays music automatically.
        Includes persistent memory context."""
        if not self._llm:
            await self._chat.send("🤖 AI не настроен. Добавь OPENROUTER_API_KEY в env.")
            return
        try:
            from .llm.prompts import ASSISTANT_SYSTEM
            from .llm.base import LLMMessage

            msgs = [LLMMessage(role="system", content=ASSISTANT_SYSTEM)]

            # Inject recent conversation history from memory
            if self._memory:
                history = self._memory.get_history(self.room_name, limit=10)
                msgs.extend(history)

            msgs.append(LLMMessage(role="user", content=message))
            resp = await self._llm.complete(msgs, max_tokens=256)
            text = resp.content.strip()
            if not text:
                return

            # AI decided it's a music request
            if text.upper().startswith("PLAY:"):
                query = text[5:].strip()
                await self._chat.send(f"🔍 AI ищет: {query}")
                await self.play(f"ytsearch1:{query}")
                if self._memory:
                    self._memory.add_history(self.room_name, "assistant", f"🤖 (play) {query}")
                return

            # Normal chat response
            await self._chat.send(f"🤖 {text}")
            if self._memory:
                self._memory.add_history(self.room_name, "assistant", text)
        except Exception as exc:
            logger.warning("[Bot] AI error: %s", exc)
            await self._chat.send("❌ Ошибка AI, попробуй ещё.")

    async def _ai_search(self, query: str) -> None:
        """Convert natural language to search query and play."""
        if not self._llm:
            await self._chat.send("🤖 AI не настроен. Добавь OPENROUTER_API_KEY в env.")
            return
        try:
            from .llm.prompts import SEARCH_SYSTEM
            from .llm.base import LLMMessage

            msgs = [
                LLMMessage(role="system", content=SEARCH_SYSTEM),
                LLMMessage(role="user", content=query),
            ]
            resp = await self._llm.complete(msgs, max_tokens=64)
            search_query = resp.content.strip()
            if search_query:
                await self._chat.send(f"🔍 AI поиск: {search_query}")
                await self.play(f"ytsearch1:{search_query}")
        except Exception as exc:
            logger.warning("[Bot] AI search error: %s", exc)
            await self._chat.send("❌ AI поиск не сработал.")

    async def _ai_playlist(self, query: str) -> None:
        """Generate playlist via AI and queue all tracks."""
        if not self._llm:
            await self._chat.send("🤖 AI не настроен. Добавь OPENROUTER_API_KEY в env.")
            return
        try:
            from .llm.prompts import PLAYLIST_SYSTEM
            from .llm.base import LLMMessage

            msgs = [
                LLMMessage(role="system", content=PLAYLIST_SYSTEM),
                LLMMessage(role="user", content=query),
            ]
            resp = await self._llm.complete(msgs, max_tokens=256)
            lines = [ln.strip() for ln in resp.content.strip().splitlines() if ln.strip() and " - " in ln]
            if not lines:
                await self._chat.send("🤖 AI не смог составить плейлист. Попробуй переформулировать.")
                return

            await self._chat.send(f"🎵 AI плейлист ({len(lines)} треков):\n" + "\n".join(f"  {ln}" for ln in lines))
            for line in lines:
                await self.queue_add(f"ytsearch1:{line}")
        except Exception as exc:
            logger.warning("[Bot] AI playlist error: %s", exc)
            await self._chat.send("❌ AI плейлист не сработал.")

    def _handle_control(self, dp: rtc.DataPacket) -> None:
        try:
            raw = dp.data
            obj = json.loads(raw) if isinstance(raw, str) else json.loads(raw.decode("utf-8"))
            cmd = obj.get("cmd")
            if not cmd:
                return
            if cmd == "leave":
                asyncio.ensure_future(self._request_shutdown())
            elif cmd == "stop":
                asyncio.ensure_future(self._run_safely(self.stop))
            elif cmd == "skip":
                asyncio.ensure_future(self._run_safely(self.skip))
            elif cmd == "mode":
                m = obj.get("mode")
                if m in ("audio", "video"):
                    self.set_mode(m)
                    asyncio.ensure_future(self._run_safely(self._update_status))
            elif cmd == "quality":
                q = obj.get("quality")
                if q:
                    self.set_quality(q)
                    asyncio.ensure_future(self._run_safely(self._update_status))
            elif cmd == "queue":
                url = obj.get("url", "").strip()
                if url:
                    asyncio.ensure_future(self._run_safely(lambda: self.queue_add(url)))
            elif cmd == "pause":
                asyncio.ensure_future(self._run_safely(self.pause))
            elif cmd == "resume":
                asyncio.ensure_future(self._run_safely(self.resume))
            elif cmd == "repeat":
                self.set_repeat(bool(obj.get("repeat", True)))
                asyncio.ensure_future(self._run_safely(self._update_status))
            elif cmd == "clear":
                asyncio.ensure_future(self._run_safely(self.queue_clear))
            elif cmd == "shuffle":
                asyncio.ensure_future(self._run_safely(self.queue_shuffle))
        except Exception as e:
            logger.warning("[Bot] Invalid control command: %s", e)

    async def _run_safely(self, coro_fn) -> None:
        async with self._command_lock:
            try:
                await coro_fn()
            except Exception:
                logger.exception("[Bot] Command error")

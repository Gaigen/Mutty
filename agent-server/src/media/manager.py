"""Media playback manager — queue, streaming, and playback state."""

import asyncio
import logging
import os
import time
from typing import Callable, Optional

from livekit import rtc

from . import streamer as media_streamer, queue as media_queue, resolver as media_resolver
from .config import (
    DEFAULT_QUALITY,
    classify_source,
    is_audio_only_source,
    is_url_safe_for_media,
)

logger = logging.getLogger(__name__)


class PlaybackManager:
    """Handles media queue, playback, pause/resume, and streaming."""

    def __init__(
        self,
        room: rtc.Room,
        chat_send: Callable[[str], asyncio.Future],
        on_status_change: Callable[[], asyncio.Future],
    ) -> None:
        self._room = room
        self._chat_send = chat_send
        self._on_status_change = on_status_change

        self._mode = "video"
        self._quality = DEFAULT_QUALITY
        self._paused = False
        self._repeat = False
        self._pause_position = 0.0
        self._stream_start_time = 0.0

        self._current_url: Optional[str] = None
        self._current_title: Optional[str] = None

        self._queue = media_queue.PlaybackQueue()
        self._streamer = media_streamer.MediaStreamer(room)

        self._command_lock = asyncio.Lock()
        self._watch_task: Optional[asyncio.Task] = None

    # ── Properties ────────────────────────────────────────────────────────────
    @property
    def is_playing(self) -> bool:
        return self._current_url is not None and not self._paused

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def quality(self) -> str:
        return self._quality

    @property
    def paused(self) -> bool:
        return self._paused

    @property
    def repeat(self) -> bool:
        return self._repeat

    @property
    def current_title(self) -> Optional[str]:
        return self._current_title

    @property
    def current_url(self) -> Optional[str]:
        return self._current_url

    @property
    def queue_length(self) -> int:
        return self._queue.length

    def status(self) -> dict:
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

    # ── Playback control ──────────────────────────────────────────────────────
    async def play(self, url: str) -> None:
        if not is_url_safe_for_media(url):
            await self._chat_send("❌ Invalid link (SSRF protection).")
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
        await self._chat_send("⏹ Playback stopped.")
        await self._on_status_change()

    async def skip(self) -> None:
        self._paused = False
        await self._stop_current()
        self._current_url = None
        self._current_title = None
        await self._play_next()
        await self._on_status_change()

    async def pause(self) -> None:
        if not self._current_url or self._paused:
            return
        self._pause_position = time.monotonic() - self._stream_start_time
        self._paused = True
        await self._stop_current()
        await self._chat_send("⏸ Paused.")
        await self._on_status_change()

    async def resume(self) -> None:
        if not self._current_url or not self._paused:
            return
        self._paused = False
        seek = max(0.0, self._pause_position)
        await self._stop_current()
        await self._start(self._current_url, seek_seconds=seek)
        await self._chat_send("▶ Resuming.")
        await self._on_status_change()

    def set_mode(self, mode: str) -> None:
        if mode in ("audio", "video") and self._mode != mode:
            self._mode = mode
            logger.info("[Media] Mode -> '%s'", mode)

    def set_quality(self, quality: str) -> None:
        if quality != self._quality:
            self._quality = quality
            self._streamer.set_quality(quality)
            logger.info("[Media] Quality -> '%s'", quality)

    def set_repeat(self, repeat: bool) -> None:
        self._repeat = repeat
        logger.info("[Media] Repeat -> %s", repeat)

    # ── Queue ─────────────────────────────────────────────────────────────────
    async def queue_add(self, raw: str) -> None:
        url = raw.strip()
        if not url:
            return
        if url.lower().startswith("youtube ") or url.lower().startswith("yt "):
            url = f"ytsearch1:{url.split(maxsplit=1)[1]}"
        elif url.lower().startswith("soundcloud ") or url.lower().startswith("sc "):
            url = f"scsearch1:{url.split(maxsplit=1)[1]}"
        if not is_url_safe_for_media(url):
            await self._chat_send("❌ Invalid link (SSRF protection).")
            return
        self._queue.add(url)
        asyncio.create_task(self._resolve_meta(url))
        display = url[:60] + ("…" if len(url) > 60 else "")
        await self._chat_send(f"➕ Queued ({self._queue.length}): {display}")
        await self._on_status_change()
        if not self.is_playing:
            await self._play_next()

    async def queue_clear(self) -> None:
        n = self._queue.clear()
        await self._chat_send(f"🗑 Queue cleared ({n} tracks).")
        await self._on_status_change()

    async def queue_shuffle(self) -> None:
        if not self._queue.shuffle():
            await self._chat_send("🔀 Queue too short to shuffle.")
            return
        await self._chat_send(f"🔀 Queue shuffled ({self._queue.length} tracks).")
        await self._on_status_change()

    async def queue_show(self) -> None:
        if self._queue.is_empty():
            await self._chat_send("📋 Queue is empty.")
            return
        lines = [f"📋 Queue ({self._queue.length}):"]
        for i, u in enumerate(self._queue.items[:8], 1):
            lines.append(self._queue.format_line(i, u))
        if self._queue.length > 8:
            lines.append(f"  … +{self._queue.length - 8}")
        await self._chat_send("\n".join(lines))

    async def search_and_play(self, source: str, query: str) -> None:
        query = query.strip()
        if not query:
            return
        if source == "youtube":
            url = f"ytsearch1:{query}"
            await self._chat_send(f"🔍 Searching YouTube: {query}")
        elif source == "soundcloud":
            url = f"scsearch1:{query}"
            await self._chat_send(f"🔍 Searching SoundCloud: {query}")
        else:
            await self._chat_send("❌ Search supported only for YouTube and SoundCloud.")
            return
        try:
            await self.play(url)
        except Exception as exc:
            await self._chat_send(f"❌ Search error: {exc}")

    # ── Internal playback ─────────────────────────────────────────────────────
    async def _start(self, url: str, seek_seconds: float = 0.0) -> None:
        self._stream_start_time = time.monotonic() - seek_seconds
        src = classify_source(url)
        pretty = {"youtube": "YouTube", "twitch": "Twitch", "soundcloud": "SoundCloud", "telegram": "Telegram"}.get(src, "other")
        label = "🎵 audio" if self._mode == "audio" else "🎬 video"
        await self._chat_send(f"⏳ Loading [{label}, {pretty}]: {url[:60]}{'…' if len(url) > 60 else ''}")

        try:
            video_url, audio_url, title, webpage_url = await media_resolver.resolve(url)
        except Exception as exc:
            await self._chat_send(f"❌ Resolve error: {exc}")
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
            if os.name == "posix":
                await self._streamer.start_av_combined(video_url, audio_url, seek_seconds)
            else:
                await self._streamer.start_av_separate(video_url, audio_url, seek_seconds)
        else:
            await self._streamer.start_audio_only(audio_url, seek_seconds)

        self._watch_task = asyncio.create_task(self._watch_stream())
        icon = "🎵" if self._mode == "audio" else "🎬"
        await self._chat_send(f"{icon} Now playing: {title or url}")
        await self._on_status_change()

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
            await self._chat_send("✅ Playback finished.")
            await self._on_status_change()
            return
        await self._start(url)

    async def _watch_stream(self) -> None:
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
            logger.exception("[Media] Stream watcher error")
        await self._play_next()

    async def _resolve_meta(self, url: str) -> None:
        try:
            _, _, title, webpage_url = await media_resolver.resolve(url)
            self._queue.cache_meta(url, title or url, webpage_url or url)
        except Exception:
            pass

    # ── Shutdown ──────────────────────────────────────────────────────────────
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

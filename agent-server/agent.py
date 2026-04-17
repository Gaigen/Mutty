"""
YouTube Bot — LiveKit participant that streams audio/video from various sources into a room.

Команды (без «!»):
  <url>                  — воспроизвести ссылку (YouTube / Twitch / SoundCloud / Telegram / др.)
  add <url> / queue <url> — добавить в очередь
  skip / next            — пропустить текущий трек (без голосования)
  queue / list           — показать очередь
  clear                  — очистить очередь
  стоп / stop            — остановить воспроизведение
  pause / resume         — пауза / продолжить (через agent-control)
  repeat                 — повтор текущего трека (через agent-control)
  аудио <url>            — только звук по ссылке
  видео <url>            — видео+звук по ссылке
  youtube <запрос>       — поиск трека/видео на YouTube
  soundcloud <запрос>    — поиск трека на SoundCloud
"""

import asyncio
from collections import deque
import ipaddress
import json
import logging
import os
import random
import re
import time
import uuid
from typing import Callable, Optional
from urllib.parse import quote_plus, urlparse

from livekit import rtc

logger = logging.getLogger(__name__)

AGENT_CONTROL_TOPIC = "agent-control"

# ── Config ────────────────────────────────────────────────────────────────────
# LIVEKIT_WS_URL = os.getenv("LIVEKIT_WS_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
    raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables must be set")
# Proxy for yt-dlp/ffmpeg only. Format: http://host:port or socks5://host:port
MEDIA_PROXY = os.getenv("AGENT_MEDIA_PROXY", "").strip() or None

BOT_IDENTITY = "youtube-bot"
BOT_NAME = "i meen to go away"
CHAT_TOPIC = os.getenv("AGENT_CHAT_TOPIC", "lk-chat-topic").strip() or "lk-chat-topic"

AUDIO_SAMPLE_RATE = 48_000
AUDIO_CHANNELS = 2
AUDIO_SAMPLES_PER_FRAME = 960  # 20 ms at 48 kHz

VIDEO_FPS = int(os.getenv("AGENT_VIDEO_FPS", "30"))

QUALITY_PRESETS: dict[str, tuple[int, int]] = {
    "360p": (640, 360),
    "480p": (854, 480),
    "720p": (1280, 720),
    "1080p": (1920, 1080),
}
DEFAULT_QUALITY = os.getenv("AGENT_VIDEO_QUALITY", "720p").strip().lower()
if DEFAULT_QUALITY not in QUALITY_PRESETS:
    DEFAULT_QUALITY = "720p"

# Любой http(s)-URL в сообщении
URL_RE = re.compile(r"https?://\S+")

# Для человекочитаемых сообщений в чате / логах
_YOUTUBE_DOMAINS = ("youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com")
_TWITCH_DOMAINS = ("twitch.tv", "www.twitch.tv", "m.twitch.tv", "clips.twitch.tv")
_SOUNDCLOUD_DOMAINS = ("soundcloud.com", "on.soundcloud.com")
_TELEGRAM_DOMAINS = ("t.me", "telegram.me", "telegram.org")

# Источники без видео — при переключении на них снимаем видео-трек, чтобы не висел последний кадр
_AUDIO_ONLY_SOURCES = ("soundcloud",)


def _is_url_safe_for_media(url: str) -> bool:
    """Block SSRF: file://, localhost, private IPs. Allow http(s) and ytsearch/scsearch."""
    if url.startswith(("ytsearch", "scsearch")):
        return True
    if url.startswith("file://"):
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = (parsed.hostname or "").strip().lower()
        if not host or host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


def _classify_source(url: str) -> str:
    """Вернёт короткое имя источника: youtube / twitch / soundcloud / telegram / other."""
    if url.startswith("ytsearch"):
        return "youtube"
    if url.startswith("scsearch"):
        return "soundcloud"
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        return "other"
    host = host.lower()
    if any(host == d or host.endswith("." + d) for d in _YOUTUBE_DOMAINS):
        return "youtube"
    if any(host == d or host.endswith("." + d) for d in _TWITCH_DOMAINS):
        return "twitch"
    if any(host == d or host.endswith("." + d) for d in _SOUNDCLOUD_DOMAINS):
        return "soundcloud"
    if any(host == d or host.endswith("." + d) for d in _TELEGRAM_DOMAINS):
        return "telegram"
    return "other"

STOP_RE = re.compile(r"^(?:!?\s*)?(стоп|stop)\s*$", re.IGNORECASE)
SKIP_RE = re.compile(r"^(?:!?\s*)?(skip|next|скип)\s*$", re.IGNORECASE)
QUEUE_CMD_RE = re.compile(r"^(?:!?\s*)?(?:add|queue|добавить|очередь)\s+(.+)", re.IGNORECASE)
QUEUE_LIST_RE = re.compile(r"^(?:!?\s*)?(?:queue|list|очередь|список)\s*$", re.IGNORECASE)
CLEAR_RE = re.compile(r"^(?:!?\s*)?(?:clear|очистить)\s*$", re.IGNORECASE)
SHUFFLE_RE = re.compile(r"^(?:!?\s*)?(?:shuffle|перемешать|шаффл)\s*$", re.IGNORECASE)
AUDIO_CMD_RE = re.compile(r"^(?:!?\s*)?аудио\s+(https?://\S+)", re.IGNORECASE)
VIDEO_CMD_RE = re.compile(r"^(?:!?\s*)?видео\s+(https?://\S+)", re.IGNORECASE)

# Поисковые команды: youtube / yt / ютуб, soundcloud / sc
YT_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:yt|youtube|ютуб)\s+(.+)$", re.IGNORECASE)
SC_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:sc|soundcloud|саундклауд)\s+(.+)$", re.IGNORECASE)


# ── Agent ─────────────────────────────────────────────────────────────────────
class YouTubeAgent:
    def __init__(self, room: rtc.Room, on_shutdown: Optional[Callable[[], None]] = None) -> None:
        self.room = room
        self.room_name = room.name
        self._on_shutdown_cb = on_shutdown

        self._mode: str = "video"          # "audio" | "video"
        self._quality: str = DEFAULT_QUALITY  # "360p" | "480p" | "720p" | "1080p"
        self._current_url: Optional[str] = None
        self._current_title: Optional[str] = None

        self._audio_source: Optional[rtc.AudioSource] = None
        self._video_source: Optional[rtc.VideoSource] = None
        self._audio_published = False
        self._video_published = False
        self._audio_sid: Optional[str] = None
        self._video_sid: Optional[str] = None

        self._audio_task: Optional[asyncio.Task] = None
        self._video_task: Optional[asyncio.Task] = None
        self._ffmpeg_audio: Optional[asyncio.subprocess.Process] = None
        self._ffmpeg_video: Optional[asyncio.subprocess.Process] = None
        self._ffmpeg_av: Optional[asyncio.subprocess.Process] = None  # combined A+V for sync
        self._command_lock = asyncio.Lock()
        self._queue: deque[str] = deque()
        self._url_to_meta: dict[str, tuple[str, str]] = {}  # url -> (title, link_url)

        self._paused: bool = False
        self._pause_position: float = 0.0  # seconds into track when paused
        self._stream_start_time: float = 0.0
        self._repeat: bool = False

    # ── Public properties ─────────────────────────────────────────────────────
    @property
    def mode(self) -> str:
        return self._mode

    @property
    def quality(self) -> str:
        return self._quality

    def _video_dimensions(self) -> tuple[int, int]:
        return QUALITY_PRESETS.get(self._quality, QUALITY_PRESETS[DEFAULT_QUALITY])

    @property
    def is_playing(self) -> bool:
        return self._current_url is not None and not self._paused

    @property
    def is_paused(self) -> bool:
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
    def queue(self) -> list[str]:
        return list(self._queue)

    def queue_display(self) -> list[tuple[str, str]]:
        """(title, link) for each queue item, for menu hyperlinks."""
        out: list[tuple[str, str]] = []
        max_title = 45
        for url in list(self._queue)[:10]:
            meta = self._url_to_meta.get(url)
            if meta:
                title, link = meta
                display = (title[:max_title] + "…") if len(title) > max_title else title
                out.append((display, link))
            elif url.startswith("ytsearch"):
                _, _, rest = url.partition(":")
                q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
                link = f"https://www.youtube.com/results?search_query={quote_plus(rest)}"
                out.append((f"🔍 {q}", link))
            elif url.startswith("scsearch"):
                _, _, rest = url.partition(":")
                q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
                link = f"https://soundcloud.com/search?q={quote_plus(rest)}"
                out.append((f"🔍 SC {q}", link))
            elif url.startswith("http"):
                short = url[:max_title] + ("…" if len(url) > max_title else "")
                out.append((short, url))
            else:
                short = url[:max_title] + ("…" if len(url) > max_title else "")
                out.append((short, ""))
        return out

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    def setup(self) -> None:
        """Register handlers. Call after ctx.connect()."""
        self.room.on("data_received", self._on_data)
        self.room.on("participant_disconnected", self._on_participant_disconnected)
        logger.info("[Bot] Connected to room '%s'", self.room_name)

    async def run(self) -> None:
        """Send welcome message and publish initial status."""
        await self._send_chat(
            "👋 YouTube Bot подключён!\n"
            "📎 Ссылку — воспроизвести  •  add <url> — в очередь  •  youtube <запрос> — поиск\n"
            "skip — пропустить  •  shuffle — перемешать  •  clear — очистить  •  queue — список"
        )
        await self._update_status_attributes()

    async def shutdown(self) -> None:
        """Clean shutdown. Called before ctx.shutdown()."""
        await self._stop_streams()
        await self._send_chat("👋 YouTube Bot disconnected.")
        logger.info("[Bot] Disconnected from room '%s'", self.room_name)
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    async def stop(self) -> None:
        """Stop playback without disconnecting the bot."""
        self._paused = False
        self._queue.clear()
        await self._stop_streams()
        self._current_url = None
        self._current_title = None

        if self._video_published and self._video_sid:
            try:
                await self.room.local_participant.unpublish_track(self._video_sid)
            except Exception as e:
                logger.warning("[Bot] Failed to unpublish video track: %s", e)
            self._video_published = False
            self._video_source = None
            self._video_sid = None

        await self._send_chat("⏹ Воспроизведение остановлено.")
        await self._update_status_attributes()
        logger.info("[Bot] Playback stopped in room '%s'", self.room_name)

    async def skip(self) -> None:
        """Skip current track, play next from queue. One skip = immediate skip (no voting)."""
        self._paused = False
        await self._stop_streams()
        self._current_url = None
        self._current_title = None
        await self._maybe_play_next()
        await self._update_status_attributes()

    async def pause(self) -> None:
        """Pause playback. Keeps current track, can resume from same position."""
        if not self._current_url or self._paused:
            return
        self._pause_position = time.monotonic() - self._stream_start_time
        self._paused = True
        await self._stop_streams()
        await self._send_chat("⏸ Пауза.")
        await self._update_status_attributes()
        logger.info("[Bot] Paused at %.1fs in room '%s'", self._pause_position, self.room_name)

    async def resume(self) -> None:
        """Resume playback from paused position."""
        if not self._current_url or not self._paused:
            return
        self._paused = False
        seek = max(0.0, self._pause_position)
        await self._stop_streams()
        await self._play_internal(self._current_url, seek_seconds=seek)
        await self._send_chat("▶ Продолжаю воспроизведение.")
        await self._update_status_attributes()

    def set_repeat(self, repeat: bool) -> None:
        """Toggle repeat current track."""
        self._repeat = repeat
        logger.info("[Bot] Repeat %s in room '%s'", "on" if repeat else "off", self.room_name)

    async def queue_add(self, url_or_query: str) -> None:
        """Add URL or search query to queue. If nothing playing, start."""
        raw = url_or_query.strip()
        if not raw:
            return
        if raw.lower().startswith("youtube ") or raw.lower().startswith("yt "):
            url = f"ytsearch1:{raw.split(maxsplit=1)[1]}"
        elif raw.lower().startswith("soundcloud ") or raw.lower().startswith("sc "):
            url = f"scsearch1:{raw.split(maxsplit=1)[1]}"
        else:
            url = raw
        if not _is_url_safe_for_media(url):
            await self._send_chat("❌ Недопустимая ссылка (SSRF protection).")
            return
        self._queue.append(url)
        asyncio.create_task(self._resolve_and_cache(url))
        display = url[:60] + ('…' if len(url) > 60 else '')
        await self._send_chat(f"➕ В очередь ({len(self._queue)}): {display}")
        await self._update_status_attributes()
        if not self.is_playing:
            await self._maybe_play_next()

    async def queue_clear(self) -> None:
        """Clear queue."""
        n = len(self._queue)
        self._queue.clear()
        await self._send_chat(f"🗑 Очередь очищена ({n} треков).")
        await self._update_status_attributes()

    async def shuffle_queue(self) -> None:
        """Shuffle the queue randomly."""
        n = len(self._queue)
        if n < 2:
            await self._send_chat("🔀 Очередь слишком короткая для перемешивания.")
            return
        items = list(self._queue)
        random.shuffle(items)
        self._queue = deque(items)
        await self._send_chat(f"🔀 Очередь перемешана ({n} треков).")
        await self._update_status_attributes()

    async def _resolve_and_cache(self, url: str) -> None:
        """Resolve URL in background and cache title+link for queue display."""
        try:
            _, _, title, webpage_url = await self._resolve(url)
            self._url_to_meta[url] = (title or url, webpage_url or url)
        except Exception:
            pass

    def _format_queue_line(self, i: int, url: str, max_title: int = 50) -> str:
        """Format queue item: always [text](url) for messageFormatter hyperlinks."""
        meta = self._url_to_meta.get(url)
        if meta:
            title, link = meta
            display = (title[:max_title] + "…") if len(title) > max_title else title
            return f"  {i}. [{display}]({link})"
        if url.startswith("ytsearch"):
            _, _, rest = url.partition(":")
            q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
            link = f"https://www.youtube.com/results?search_query={quote_plus(rest)}"
            return f"  {i}. 🔍 [{q}]({link})"
        if url.startswith("scsearch"):
            _, _, rest = url.partition(":")
            q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
            link = f"https://soundcloud.com/search?q={quote_plus(rest)}"
            return f"  {i}. 🔍 SC [{q}]({link})"
        if url.startswith("http"):
            short = url[:max_title] + ("…" if len(url) > max_title else "")
            return f"  {i}. [{short}]({url})"
        short = url[:max_title] + ("…" if len(url) > max_title else "")
        return f"  {i}. {short}"

    async def _show_queue(self) -> None:
        """Show queue in chat: titles with hyperlinks where cached."""
        if not self._queue:
            await self._send_chat("📋 Очередь пуста.")
            return
        items = list(self._queue)[:8]
        lines = [f"📋 Очередь ({len(self._queue)}):"]
        for i, u in enumerate(items, 1):
            lines.append(self._format_queue_line(i, u))
        if len(self._queue) > 8:
            lines.append(f"  … +{len(self._queue) - 8}")
        await self._send_chat("\n".join(lines))

    async def _maybe_play_next(self) -> None:
        """Play next from queue, or stop if empty."""
        if self._paused:
            return
        if self._repeat and self._current_url:
            self._queue.appendleft(self._current_url)
        if not self._queue:
            self._current_url = None
            self._current_title = None
            if self._audio_published and self._audio_sid:
                try:
                    await self.room.local_participant.unpublish_track(self._audio_sid)
                except Exception as e:
                    logger.warning("[Bot] Failed to unpublish audio track: %s", e)
                self._audio_published = False
                self._audio_source = None
                self._audio_sid = None
            if self._video_published and self._video_sid:
                try:
                    await self.room.local_participant.unpublish_track(self._video_sid)
                except Exception as e:
                    logger.warning("[Bot] Failed to unpublish video track: %s", e)
                self._video_published = False
                self._video_source = None
                self._video_sid = None
            await self._send_chat("✅ Воспроизведение завершено.")
            await self._update_status_attributes()
            return
        await self._stop_streams()
        url = self._queue.popleft()
        await self._play_internal(url)

    async def _play_internal(self, url: str, seek_seconds: float = 0.0) -> None:
        """Internal: resolve and start streaming. Called by play() and _maybe_play_next().
        seek_seconds: start from this position (for resume after pause)."""
        self._stream_start_time = time.monotonic() - seek_seconds
        label = "🎵 аудио" if self._mode == "audio" else "🎬 видео"
        src = _classify_source(url)
        pretty_src = {
            "youtube": "YouTube",
            "twitch": "Twitch",
            "soundcloud": "SoundCloud",
            "telegram": "Telegram",
        }.get(src, "другой источник")
        await self._send_chat(f"⏳ Загружаю [{label}, {pretty_src}]: {url[:60]}{'…' if len(url) > 60 else ''}")

        try:
            video_url, audio_url, title, webpage_url = await self._resolve(url)
        except Exception as exc:
            await self._send_chat(f"❌ Не удалось получить ссылку: {exc}")
            self._current_url = None
            self._current_title = None
            await self._maybe_play_next()
            return

        self._url_to_meta[url] = (title or url, webpage_url or url)

        await self._ensure_audio_track()
        has_video = self._mode == "video" and src not in _AUDIO_ONLY_SOURCES
        if has_video:
            await self._ensure_video_track()
        else:
            # Аудио-источник (SoundCloud и т.п.) — снимаем видео, чтобы не висел последний кадр
            if self._video_published and self._video_sid:
                try:
                    await self.room.local_participant.unpublish_track(self._video_sid)
                except Exception as e:
                    logger.warning("[Bot] Failed to unpublish video track: %s", e)
                self._video_published = False
                self._video_source = None
                self._video_sid = None

        self._current_url = url
        self._current_title = title

        if has_video:
            if os.name == "posix":
                self._audio_task = asyncio.create_task(
                    self._stream_av_combined(video_url, audio_url, seek_seconds)
                )
            else:
                self._audio_task = asyncio.create_task(self._stream_audio(audio_url, seek_seconds))
                self._video_task = asyncio.create_task(self._stream_video(video_url, seek_seconds))
        else:
            self._audio_task = asyncio.create_task(self._stream_audio(audio_url, seek_seconds))

        icon = "🎵" if self._mode == "audio" else "🎬"
        await self._send_chat(f"{icon} Играет: {title or url}")
        await self._update_status_attributes()

    def set_mode(self, mode: str) -> None:
        """Change streaming mode ('audio' | 'video'). Takes effect on next play()."""
        if mode in ("audio", "video"):
            old = self._mode
            self._mode = mode
            if old != mode:
                logger.info("[Bot] Mode changed to '%s' in room '%s'", mode, self.room_name)

    def set_quality(self, quality: str) -> None:
        """Change video quality preset. Takes effect on next play()."""
        if quality in QUALITY_PRESETS:
            old = self._quality
            self._quality = quality
            if old != quality:
                logger.info("[Bot] Quality changed to '%s' in room '%s'", quality, self.room_name)

    def _status_dict(self) -> dict:
        """Build status dict for attributes."""
        # If _current_url is a search query (ytsearch/scsearch), resolve to real webpage_url
        display_url: Optional[str] = None
        if self._current_url:
            meta = self._url_to_meta.get(self._current_url)
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
            "queue_length": len(self._queue),
            "queue_display": self.queue_display(),
        }

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        """Leave room when agent is alone (no other participants)."""
        if len(self.room.remote_participants) == 0:
            logger.info("[Bot] Alone in room '%s', disconnecting", self.room_name)
            asyncio.ensure_future(self._request_shutdown())

    async def _request_shutdown(self) -> None:
        """Request agent shutdown (alone or leave command).
        Only triggers callback; main loop will call shutdown() to avoid double execution."""
        if self._on_shutdown_cb:
            self._on_shutdown_cb()

    async def _update_status_attributes(self) -> None:
        """Publish status to participant attributes for frontend."""
        if self.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            return
        try:
            await self.room.local_participant.set_attributes({"bot:status": json.dumps(self._status_dict())})
        except Exception as exc:
            logger.warning("[Bot] Failed to update status attributes: %s", exc)

    # ── Chat listener ─────────────────────────────────────────────────────────
    def _on_data(self, dp: rtc.DataPacket) -> None:
        try:
            topic = (dp.topic or "") if hasattr(dp, "topic") else ""
            if topic == AGENT_CONTROL_TOPIC:
                self._handle_control_command(dp)
                return

            if dp.participant is not None and getattr(dp.participant, "identity", None) == BOT_IDENTITY:
                return
            text = dp.data.decode("utf-8")
            try:
                obj = json.loads(text)
                if isinstance(obj, dict):
                    text = obj.get("message", text)
            except (json.JSONDecodeError, TypeError):
                pass

            text = text.strip()

            if STOP_RE.match(text):
                asyncio.ensure_future(self._run_command(self.stop))
                return

            if SKIP_RE.match(text):
                asyncio.ensure_future(self._run_command(self.skip))
                return

            m = QUEUE_CMD_RE.match(text)
            if m:
                arg = m.group(1).strip()
                if arg:
                    asyncio.ensure_future(self._run_command(lambda: self.queue_add(arg)))
                return

            # queue / list — без lock, чтобы не блокироваться при долгом play
            if QUEUE_LIST_RE.match(text):
                asyncio.ensure_future(self._show_queue())
                return

            if CLEAR_RE.match(text):
                asyncio.ensure_future(self._run_command(self.queue_clear))
                return

            if SHUFFLE_RE.match(text):
                asyncio.ensure_future(self._run_command(self.shuffle_queue))
                return

            m = AUDIO_CMD_RE.match(text)
            if m:
                self._mode = "audio"
                asyncio.ensure_future(self._run_command(lambda: self.play(m.group(1))))
                return

            m = VIDEO_CMD_RE.match(text)
            if m:
                self._mode = "video"
                asyncio.ensure_future(self._run_command(lambda: self.play(m.group(1))))
                return

            m = YT_SEARCH_RE.match(text)
            if m:
                query = m.group(1).strip()
                if query:
                    asyncio.ensure_future(self._run_command(lambda: self._search_and_play("youtube", query)))
                return

            m = SC_SEARCH_RE.match(text)
            if m:
                query = m.group(1).strip()
                if query:
                    asyncio.ensure_future(self._run_command(lambda: self._search_and_play("soundcloud", query)))
                return

            match = URL_RE.search(text)
            if match:
                url = match.group(0)
                source = _classify_source(url)
                logger.info("[Bot] URL detected (%s): %s", source, url)
                asyncio.ensure_future(self._run_command(lambda: self.play(url)))

        except Exception:
            logger.exception("[Bot] Error in _on_data")

    def _handle_control_command(self, dp: rtc.DataPacket) -> None:
        """Handle JSON commands from frontend (topic=agent-control)."""
        try:
            raw = dp.data
            if isinstance(raw, str):
                obj = json.loads(raw)
            else:
                obj = json.loads(raw.decode("utf-8"))
            cmd = obj.get("cmd")
            if not cmd:
                return
            if cmd == "leave":
                asyncio.ensure_future(self._request_shutdown())
            elif cmd == "stop":
                asyncio.ensure_future(self._run_command(self.stop))
            elif cmd == "skip":
                asyncio.ensure_future(self._run_command(self.skip))
            elif cmd == "mode":
                m = obj.get("mode")
                if m in ("audio", "video"):
                    self.set_mode(m)
                    asyncio.ensure_future(self._run_command(lambda: self._update_status_attributes()))
            elif cmd == "quality":
                q = obj.get("quality")
                if q in QUALITY_PRESETS:
                    self.set_quality(q)
                    asyncio.ensure_future(self._run_command(lambda: self._update_status_attributes()))
            elif cmd == "queue":
                url = obj.get("url", "").strip()
                if url:
                    asyncio.ensure_future(self._run_command(lambda: self.queue_add(url)))
            elif cmd == "pause":
                asyncio.ensure_future(self._run_command(self.pause))
            elif cmd == "resume":
                asyncio.ensure_future(self._run_command(self.resume))
            elif cmd == "repeat":
                r = obj.get("repeat", True)
                self.set_repeat(bool(r))
                asyncio.ensure_future(self._run_command(lambda: self._update_status_attributes()))
            elif cmd == "clear":
                asyncio.ensure_future(self._run_command(self.queue_clear))
            elif cmd == "shuffle":
                asyncio.ensure_future(self._run_command(self.shuffle_queue))
        except (json.JSONDecodeError, TypeError, KeyError) as e:
            logger.warning("[Bot] Invalid control command: %s", e)

    async def _run_command(self, coro_fn) -> None:
        """Run command under lock to prevent race conditions."""
        async with self._command_lock:
            await coro_fn()

    # ── Playback ──────────────────────────────────────────────────────────────
    async def play(self, url: str) -> None:
        """Play URL now (replaces current, queue unchanged)."""
        if not _is_url_safe_for_media(url):
            await self._send_chat("❌ Недопустимая ссылка (SSRF protection).")
            return
        await self._stop_streams()
        await self._play_internal(url)

    # ── Search helpers ──────────────────────────────────────────────────────────
    async def _search_and_play(self, source: str, query: str) -> None:
        """Поиск одного трека на YouTube / SoundCloud и немедленное воспроизведение."""
        query = query.strip()
        if not query:
            return

        if source == "youtube":
            search_url = f"ytsearch1:{query}"
            await self._send_chat(f"🔍 Ищу на YouTube: {query}")
        elif source == "soundcloud":
            search_url = f"scsearch1:{query}"
            await self._send_chat(f"🔍 Ищу на SoundCloud: {query}")
        else:
            await self._send_chat("❌ Поиск поддерживается только для YouTube и SoundCloud.")
            return

        try:
            await self.play(search_url)
        except Exception as exc:
            await self._send_chat(f"❌ Ошибка при поиске: {exc}")

    def _subprocess_env_for_media(self) -> dict:
        """Окружение только для yt-dlp/ffmpeg — через прокси, LiveKit не трогаем.
        Всегда возвращает dict (не os.environ) — некоторые библиотеки ожидают именно dict."""
        env = dict(os.environ)
        if MEDIA_PROXY:
            env["HTTP_PROXY"] = MEDIA_PROXY
            env["HTTPS_PROXY"] = MEDIA_PROXY
            env["http_proxy"] = MEDIA_PROXY
            env["https_proxy"] = MEDIA_PROXY
        return env

    async def _resolve(self, url: str) -> tuple[str, str, str, str]:
        """Returns (video_url, audio_url, title, webpage_url)."""
        _, height = self._video_dimensions()
        yt_extra = ["--proxy", MEDIA_PROXY] if MEDIA_PROXY else []
        url_proc = await asyncio.create_subprocess_exec(
            "yt-dlp", "--no-playlist", "--no-warnings", *yt_extra,
            "-f", (
                f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]"
                f"/bestvideo[height<={height}]+bestaudio"
                f"/best[height<={height}]/best"
            ),
            "--get-url", url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=self._subprocess_env_for_media(),
        )
        stdout, stderr = await asyncio.wait_for(url_proc.communicate(), timeout=30)
        lines = [ln for ln in stdout.decode().strip().splitlines() if ln.startswith("http")]
        if not lines:
            raise RuntimeError(stderr.decode()[:200] or "yt-dlp вернул пустой результат")

        video_url = lines[0]
        audio_url = lines[1] if len(lines) >= 2 else lines[0]

        title = ""
        webpage_url = url if url.startswith("http") else ""
        try:
            async def get_title():
                p = await asyncio.create_subprocess_exec(
                    "yt-dlp", "--no-playlist", *yt_extra, "--get-title", url,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                    env=self._subprocess_env_for_media(),
                )
                out, _ = await asyncio.wait_for(p.communicate(), timeout=15)
                return out.decode().strip()

            async def get_link():
                p = await asyncio.create_subprocess_exec(
                    "yt-dlp", "--no-playlist", *yt_extra, "--print", "webpage_url", url,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                    env=self._subprocess_env_for_media(),
                )
                out, _ = await asyncio.wait_for(p.communicate(), timeout=15)
                return out.decode().strip()

            title, link = await asyncio.gather(get_title(), get_link())
            if link.startswith("http"):
                webpage_url = link
        except Exception:
            pass

        return video_url, audio_url, title, webpage_url

    # ── Track management ──────────────────────────────────────────────────────
    async def _ensure_audio_track(self) -> None:
        if self._audio_published:
            return
        self._audio_source = rtc.AudioSource(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS)
        track = rtc.LocalAudioTrack.create_audio_track("yt-audio", self._audio_source)
        pub = await self.room.local_participant.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE),
        )
        self._audio_sid = pub.sid
        self._audio_published = True
        logger.info("[Bot] Audio track published")

    async def _ensure_video_track(self) -> None:
        if self._video_published:
            return
        w, h = self._video_dimensions()
        self._video_source = rtc.VideoSource(w, h)
        track = rtc.LocalVideoTrack.create_video_track("yt-video", self._video_source)
        pub = await self.room.local_participant.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_CAMERA),
        )
        self._video_sid = pub.sid
        self._video_published = True
        logger.info("[Bot] Video track published")

    # ── ffmpeg pipelines ──────────────────────────────────────────────────────
    def _ffmpeg_seek_args(self, seek_seconds: float) -> list[str]:
        """Return -ss args for input seek (fast)."""
        if seek_seconds <= 0:
            return []
        return ["-ss", str(seek_seconds)]

    async def _stream_audio(self, url: str, seek_seconds: float = 0.0) -> None:
        bytes_per_frame = AUDIO_SAMPLES_PER_FRAME * AUDIO_CHANNELS * 2
        seek_args = self._ffmpeg_seek_args(seek_seconds)
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            *seek_args, "-re", "-i", url, "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(AUDIO_SAMPLE_RATE),
            "-ac", str(AUDIO_CHANNELS),
            "-f", "s16le", "-loglevel", "quiet",
            "pipe:1",
        ]
        ffmpeg_env = self._subprocess_env_for_media()
        self._ffmpeg_audio = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=ffmpeg_env,
        )
        assert self._ffmpeg_audio.stdout
        assert self._audio_source

        try:
            while True:
                raw = await self._ffmpeg_audio.stdout.readexactly(bytes_per_frame)
                await self._audio_source.capture_frame(
                    rtc.AudioFrame(
                        data=raw,
                        sample_rate=AUDIO_SAMPLE_RATE,
                        num_channels=AUDIO_CHANNELS,
                        samples_per_channel=AUDIO_SAMPLES_PER_FRAME,
                    )
                )
        except asyncio.IncompleteReadError:
            logger.info("[Bot] Audio stream finished")
            asyncio.create_task(self._maybe_play_next())
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Bot] Audio stream error")

    async def _stream_video(self, url: str, seek_seconds: float = 0.0) -> None:
        w, h = self._video_dimensions()
        frame_bytes = w * h * 3 // 2
        # Letterbox: сохраняем пропорции, чёрные полосы по краям. Lanczos — лучшее качество.
        vf = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,fps={VIDEO_FPS}"
        )
        seek_args = self._ffmpeg_seek_args(seek_seconds)
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            # -re: читать вход со скоростью воспроизведения (real-time).
            # Без этого флага ffmpeg буферизует поток быстрее реального времени,
            # что нарушает синхронизацию с аудио-потоком.
            *seek_args, "-re", "-i", url, "-an",
            "-vf", vf,
            "-pix_fmt", "yuv420p",
            "-f", "rawvideo", "-loglevel", "quiet",
            "pipe:1",
        ]
        ffmpeg_env = self._subprocess_env_for_media()
        self._ffmpeg_video = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=ffmpeg_env,
        )
        assert self._ffmpeg_video.stdout
        assert self._video_source

        try:
            while True:
                raw = await self._ffmpeg_video.stdout.readexactly(frame_bytes)
                self._video_source.capture_frame(
                    rtc.VideoFrame(
                        width=w,
                        height=h,
                        type=rtc.VideoBufferType.I420,
                        data=bytearray(raw),
                    )
                )
                # Throttling не нужен: ffmpeg с флагом -re сам выдаёт кадры в реальном времени.
                # Пайп естественно блокирует readexactly до появления следующего кадра.
        except asyncio.IncompleteReadError:
            logger.info("[Bot] Video stream finished")
            # Audio stream triggers _maybe_play_next; we just exit
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Bot] Video stream error")

    async def _stream_av_combined(
        self, video_url: str, audio_url: str, seek_seconds: float = 0.0
    ) -> None:
        """Single ffmpeg: audio→stdout, video→pipe. Keeps A/V in sync.

        video_url may be video-only; audio_url may be audio-only (typical for YouTube).
        When they are the same URL, a single input is used.
        """
        w, h = self._video_dimensions()
        frame_bytes = w * h * 3 // 2
        bytes_per_frame = AUDIO_SAMPLES_PER_FRAME * AUDIO_CHANNELS * 2

        vf = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,fps={VIDEO_FPS}"
        )
        r_video, w_video = os.pipe()
        reconnect = ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"]
        seek_args = self._ffmpeg_seek_args(seek_seconds)
        try:
            if video_url == audio_url:
                # Single muxed file: both streams inside one input.
                # -re: выдавать данные в реальном времени (не быстрее скорости воспроизведения).
                cmd = [
                    "ffmpeg", "-loglevel", "quiet",
                    *reconnect, *seek_args, "-re", "-i", video_url,
                    "-map", "0:a", "-acodec", "pcm_s16le",
                    "-ar", str(AUDIO_SAMPLE_RATE), "-ac", str(AUDIO_CHANNELS),
                    "-f", "s16le", "pipe:1",
                    "-map", "0:v", "-vf", vf, "-pix_fmt", "yuv420p",
                    "-f", "rawvideo", f"pipe:{w_video}",
                ]
            else:
                # Separate video and audio streams (typical YouTube DASH).
                # -re на каждом входе: ffmpeg сам удерживает оба потока в реальном времени.
                # Без -re ffmpeg буферизует данные пачками → аудио-ридер получает рывки
                # вместо равномерного потока → Python-sleep в видео-ридере сбивает синхрон.
                cmd = [
                    "ffmpeg", "-loglevel", "quiet",
                    *reconnect, *seek_args, "-re", "-i", video_url,
                    *reconnect, *seek_args, "-re", "-i", audio_url,
                    "-map", "1:a", "-acodec", "pcm_s16le",
                    "-ar", str(AUDIO_SAMPLE_RATE), "-ac", str(AUDIO_CHANNELS),
                    "-f", "s16le", "pipe:1",
                    "-map", "0:v", "-vf", vf, "-pix_fmt", "yuv420p",
                    "-f", "rawvideo", f"pipe:{w_video}",
                ]
            ffmpeg_env = self._subprocess_env_for_media()
            self._ffmpeg_av = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                pass_fds=(w_video,),
                env=ffmpeg_env,
            )
        finally:
            os.close(w_video)

        assert self._ffmpeg_av.stdout
        assert self._audio_source and self._video_source

        async def read_audio() -> None:
            try:
                while True:
                    raw = await self._ffmpeg_av.stdout.readexactly(bytes_per_frame)
                    await self._audio_source.capture_frame(
                        rtc.AudioFrame(
                            data=raw,
                            sample_rate=AUDIO_SAMPLE_RATE,
                            num_channels=AUDIO_CHANNELS,
                            samples_per_channel=AUDIO_SAMPLES_PER_FRAME,
                        )
                    )
            except asyncio.IncompleteReadError:
                pass
            except asyncio.CancelledError:
                pass

        async def read_video() -> None:
            def read_exactly() -> bytes:
                data = b""
                while len(data) < frame_bytes:
                    chunk = os.read(r_video, frame_bytes - len(data))
                    if not chunk:
                        raise asyncio.IncompleteReadError(data, frame_bytes)
                    data += chunk
                return data

            try:
                while True:
                    # asyncio.to_thread блокируется в os.read до появления данных от ffmpeg.
                    # Скорость регулируется флагом -re на стороне ffmpeg — ручной sleep не нужен.
                    # Ранее sleep создавал backpressure на видео-пайп → ffmpeg стопорился →
                    # аудио доставлялось рывками → рассинхрон.
                    raw = await asyncio.to_thread(read_exactly)
                    self._video_source.capture_frame(
                        rtc.VideoFrame(
                            width=w,
                            height=h,
                            type=rtc.VideoBufferType.I420,
                            data=bytearray(raw),
                        )
                    )
            except (asyncio.IncompleteReadError, OSError):
                pass
            except asyncio.CancelledError:
                pass

        cancelled = False
        try:
            await asyncio.gather(
                asyncio.create_task(read_audio()),
                asyncio.create_task(read_video()),
            )
        except asyncio.CancelledError:
            cancelled = True
        except Exception:
            logger.exception("[Bot] A/V stream error")
        finally:
            try:
                os.close(r_video)
            except OSError:
                pass
            logger.info("[Bot] A/V stream finished")
            if not cancelled:
                asyncio.create_task(self._maybe_play_next())

    # ── Internal helpers ──────────────────────────────────────────────────────
    async def _stop_streams(self) -> None:
        for task in (self._audio_task, self._video_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        for proc in (self._ffmpeg_audio, self._ffmpeg_video, self._ffmpeg_av):
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass

        self._audio_task = self._video_task = None
        self._ffmpeg_audio = self._ffmpeg_video = self._ffmpeg_av = None

    async def _send_chat(self, message: str) -> None:
        if self.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            return
        payload = json.dumps(
            {"id": uuid.uuid4().hex[:8], "timestamp": int(time.time() * 1000), "message": message}
        ).encode()
        try:
            await self.room.local_participant.publish_data(
                payload,
                reliable=True,
                topic=CHAT_TOPIC,
            )
        except Exception as exc:
            logger.warning("[Bot] Failed to send chat message: %s", exc)

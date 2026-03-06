"""
YouTube Bot — LiveKit participant that streams audio/video from various sources into a room.

Команды (без «!»):
  <url>                  — воспроизвести ссылку (YouTube / Twitch / SoundCloud / Telegram / др.)
  стоп / stop            — остановить воспроизведение
  аудио <url>            — только звук по ссылке
  видео <url>            — видео+звук по ссылке
  youtube <запрос>       — поиск трека/видео на YouTube
  soundcloud <запрос>    — поиск трека на SoundCloud
"""

import asyncio
import ipaddress
import json
import logging
import os
import re
import time
import uuid
from typing import Callable, Optional
from urllib.parse import urlparse

from livekit import rtc
from livekit.api import AccessToken, VideoGrants

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "devkey")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "secret")

# Прокси только для загрузки медиа (yt-dlp, ffmpeg). К LiveKit агент ходит напрямую.
# Формат: http://host:port или socks5://host:port. Для VLESS — укажи локальный HTTP/SOCKS клиент (v2ray/xray и т.д.).
MEDIA_PROXY = os.getenv("AGENT_MEDIA_PROXY", "").strip() or None

BOT_IDENTITY = "youtube-bot"
BOT_NAME = "i meen to go away"
CHAT_TOPIC = "lk-chat-topic"

AUDIO_SAMPLE_RATE = 48_000
AUDIO_CHANNELS = 2
AUDIO_SAMPLES_PER_FRAME = 960  # 20 ms at 48 kHz

# Разрешение стрима. 1080p — лучше для широкого видео, 720p — экономия трафика.
VIDEO_WIDTH = int(os.getenv("AGENT_VIDEO_WIDTH", "1920"))
VIDEO_HEIGHT = int(os.getenv("AGENT_VIDEO_HEIGHT", "1080"))
VIDEO_FPS = int(os.getenv("AGENT_VIDEO_FPS", "30"))

# Black frame YUV420p: Y=0, U=V=128 (one frame, reused when stopping)
_BLACK_FRAME: Optional[bytearray] = None


def _get_black_frame() -> bytearray:
    global _BLACK_FRAME
    if _BLACK_FRAME is None:
        y_size = VIDEO_WIDTH * VIDEO_HEIGHT
        uv_size = (VIDEO_WIDTH // 2) * (VIDEO_HEIGHT // 2)
        _BLACK_FRAME = bytearray(y_size)
        _BLACK_FRAME.extend(bytes([128] * uv_size))  # U
        _BLACK_FRAME.extend(bytes([128] * uv_size))  # V
    return _BLACK_FRAME


# Любой http(s)-URL в сообщении
URL_RE = re.compile(r"https?://\S+")

# Для человекочитаемых сообщений в чате / логах
_YOUTUBE_DOMAINS = ("youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com")
_TWITCH_DOMAINS = ("twitch.tv", "www.twitch.tv", "m.twitch.tv", "clips.twitch.tv")
_SOUNDCLOUD_DOMAINS = ("soundcloud.com", "on.soundcloud.com")
_TELEGRAM_DOMAINS = ("t.me", "telegram.me", "telegram.org")


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
    # Специальные псевдо-URL для поиска yt-dlp
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
AUDIO_CMD_RE = re.compile(r"^(?:!?\s*)?аудио\s+(https?://\S+)", re.IGNORECASE)
VIDEO_CMD_RE = re.compile(r"^(?:!?\s*)?видео\s+(https?://\S+)", re.IGNORECASE)

# Поисковые команды: youtube / yt / ютуб, soundcloud / sc
YT_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:yt|youtube|ютуб)\s+(.+)$", re.IGNORECASE)
SC_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:sc|soundcloud|саундклауд)\s+(.+)$", re.IGNORECASE)


# ── Agent ─────────────────────────────────────────────────────────────────────
class YouTubeAgent:
    def __init__(self, room_name: str, on_disconnect: Optional[Callable[[], None]] = None) -> None:
        self.room_name = room_name
        self.room = rtc.Room()
        self._on_disconnect_cb = on_disconnect

        self._mode: str = "video"          # "audio" | "video"
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
        self._command_lock = asyncio.Lock()

    # ── Public properties ─────────────────────────────────────────────────────
    @property
    def mode(self) -> str:
        return self._mode

    @property
    def is_playing(self) -> bool:
        return self._current_url is not None

    @property
    def current_title(self) -> Optional[str]:
        return self._current_title

    @property
    def current_url(self) -> Optional[str]:
        return self._current_url

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    async def connect(self) -> None:
        token = (
            AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(BOT_IDENTITY)
            .with_name(BOT_NAME)
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=self.room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
            .to_jwt()
        )
        self.room.on("data_received", self._on_data)
        self.room.on("participant_disconnected", self._on_participant_disconnected)
        await self.room.connect(LIVEKIT_URL, token)
        logger.info("[Bot] Connected to room '%s'", self.room_name)
        await self._send_chat(
            "👋 YouTube Bot подключён!\n"
            "📎 Отправьте ссылку на YouTube / Twitch / SoundCloud или публичный Telegram-пост с медиа — начну воспроизведение через yt-dlp.\n"
            "💡 Команды: аудио <url> · видео <url> · стоп"
        )

    async def disconnect(self) -> None:
        await self._stop_streams()
        await self._send_chat("👋 YouTube Bot disconnected.")
        if self.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            await self.room.disconnect()
        logger.info("[Bot] Disconnected from room '%s'", self.room_name)
        if self._on_disconnect_cb:
            self._on_disconnect_cb()

    async def stop(self) -> None:
        """Stop playback without disconnecting the bot."""
        await self._stop_streams()
        self._current_url = None
        self._current_title = None

        # Полностью убираем видео-трек, чтобы не висел последний кадр.
        if self._video_published and self._video_sid:
            try:
                await self.room.local_participant.unpublish_track(self._video_sid)
            except Exception as e:
                logger.warning("[Bot] Failed to unpublish video track: %s", e)
            self._video_published = False
            self._video_source = None
            self._video_sid = None

        await self._send_chat("⏹ Воспроизведение остановлено.")
        logger.info("[Bot] Playback stopped in room '%s'", self.room_name)

    def set_mode(self, mode: str) -> None:
        """Change streaming mode ('audio' | 'video'). Takes effect on next play()."""
        if mode in ("audio", "video"):
            old = self._mode
            self._mode = mode
            if old != mode:
                logger.info("[Bot] Mode changed to '%s' in room '%s'", mode, self.room_name)

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        """Leave room when agent is alone (no other participants)."""
        if len(self.room.remote_participants) == 0:
            logger.info("[Bot] Alone in room '%s', disconnecting", self.room_name)
            asyncio.ensure_future(self.disconnect())

    # ── Chat listener ─────────────────────────────────────────────────────────
    def _on_data(self, dp: rtc.DataPacket) -> None:
        try:
            text = dp.data.decode("utf-8")
            try:
                obj = json.loads(text)
                if isinstance(obj, dict):
                    text = obj.get("message", text)
            except (json.JSONDecodeError, TypeError):
                pass

            text = text.strip()

            # стоп / stop
            if STOP_RE.match(text):
                asyncio.ensure_future(self._run_command(self.stop))
                return

            # аудио <url>
            m = AUDIO_CMD_RE.match(text)
            if m:
                self._mode = "audio"
                asyncio.ensure_future(self._run_command(lambda: self.play(m.group(1))))
                return

            # видео <url>
            m = VIDEO_CMD_RE.match(text)
            if m:
                self._mode = "video"
                asyncio.ensure_future(self._run_command(lambda: self.play(m.group(1))))
                return

            # youtube / yt / ютуб <query>
            m = YT_SEARCH_RE.match(text)
            if m:
                query = m.group(1).strip()
                if query:
                    asyncio.ensure_future(self._run_command(lambda: self._search_and_play("youtube", query)))
                return

            # soundcloud / sc / саундклауд <query>
            m = SC_SEARCH_RE.match(text)
            if m:
                query = m.group(1).strip()
                if query:
                    asyncio.ensure_future(self._run_command(lambda: self._search_and_play("soundcloud", query)))
                return

            # Любой URL — используем текущий режим, но сразу говорим источник
            match = URL_RE.search(text)
            if match:
                url = match.group(0)
                source = _classify_source(url)
                logger.info("[Bot] URL detected (%s): %s", source, url)
                asyncio.ensure_future(self._run_command(lambda: self.play(url)))

        except Exception:
            logger.exception("[Bot] Error in _on_data")

    async def _run_command(self, coro_fn) -> None:
        """Run command under lock to prevent race conditions."""
        async with self._command_lock:
            await coro_fn()

    # ── Playback ──────────────────────────────────────────────────────────────
    async def play(self, url: str) -> None:
        if not _is_url_safe_for_media(url):
            await self._send_chat("❌ Недопустимая ссылка (SSRF protection).")
            return
        await self._stop_streams()
        label = "🎵 аудио" if self._mode == "audio" else "🎬 видео"
        src = _classify_source(url)
        pretty_src = {
            "youtube": "YouTube",
            "twitch": "Twitch",
            "soundcloud": "SoundCloud",
            "telegram": "Telegram",
        }.get(src, "другой источник")
        await self._send_chat(f"⏳ Загружаю [{label}, {pretty_src}]: {url}")

        try:
            video_url, audio_url, title = await self._resolve(url)
        except Exception as exc:
            self._current_url = None
            await self._send_chat(f"❌ Не удалось получить ссылку: {exc}")
            return

        await self._ensure_audio_track()
        if self._mode == "video":
            await self._ensure_video_track()

        self._current_url = url
        self._current_title = title

        self._audio_task = asyncio.create_task(self._stream_audio(audio_url))
        if self._mode == "video":
            self._video_task = asyncio.create_task(self._stream_video(video_url))

        icon = "🎵" if self._mode == "audio" else "🎬"
        await self._send_chat(f"{icon} Играет: {title or url}")

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

    async def _resolve(self, url: str) -> tuple[str, str, str]:
        yt_extra = ["--proxy", MEDIA_PROXY] if MEDIA_PROXY else []
        url_proc = await asyncio.create_subprocess_exec(
            "yt-dlp", "--no-playlist", "--no-warnings", *yt_extra,
            "-f", (
                f"bestvideo[height<={VIDEO_HEIGHT}][ext=mp4]+bestaudio[ext=m4a]"
                f"/bestvideo[height<={VIDEO_HEIGHT}]+bestaudio"
                f"/best[height<={VIDEO_HEIGHT}]/best"
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
        try:
            tp = await asyncio.create_subprocess_exec(
                "yt-dlp", "--no-playlist", *yt_extra, "--get-title", url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                env=self._subprocess_env_for_media(),
            )
            tout, _ = await asyncio.wait_for(tp.communicate(), timeout=15)
            title = tout.decode().strip()
        except Exception:
            pass

        return video_url, audio_url, title

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
        self._video_source = rtc.VideoSource(VIDEO_WIDTH, VIDEO_HEIGHT)
        track = rtc.LocalVideoTrack.create_video_track("yt-video", self._video_source)
        pub = await self.room.local_participant.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_CAMERA),
        )
        self._video_sid = pub.sid
        self._video_published = True
        logger.info("[Bot] Video track published")

    # ── ffmpeg pipelines ──────────────────────────────────────────────────────
    async def _stream_audio(self, url: str) -> None:
        bytes_per_frame = AUDIO_SAMPLES_PER_FRAME * AUDIO_CHANNELS * 2
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            "-i", url, "-vn",
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
            self._current_url = None
            self._current_title = None
            logger.info("[Bot] Audio stream finished")
            # Убираем аудио-трек после окончания, чтобы не висел пустой тайл
            if self._audio_published and self._audio_sid:
                try:
                    await self.room.local_participant.unpublish_track(self._audio_sid)
                except Exception as e:
                    logger.warning("[Bot] Failed to unpublish audio track: %s", e)
                self._audio_published = False
                self._audio_source = None
                self._audio_sid = None
            await self._send_chat("✅ Воспроизведение завершено.")
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Bot] Audio stream error")

    async def _stream_video(self, url: str) -> None:
        frame_bytes = VIDEO_WIDTH * VIDEO_HEIGHT * 3 // 2
        frame_duration = 1.0 / VIDEO_FPS
        # Letterbox: сохраняем пропорции, чёрные полосы по краям. Lanczos — лучшее качество.
        vf = (
            f"scale={VIDEO_WIDTH}:{VIDEO_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={VIDEO_WIDTH}:{VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,fps={VIDEO_FPS}"
        )
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            "-i", url, "-an",
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
                loop = asyncio.get_running_loop()
                t0 = loop.time()
                raw = await self._ffmpeg_video.stdout.readexactly(frame_bytes)
                self._video_source.capture_frame(
                    rtc.VideoFrame(
                        width=VIDEO_WIDTH,
                        height=VIDEO_HEIGHT,
                        type=rtc.VideoBufferType.I420,
                        data=bytearray(raw),
                    )
                )
                elapsed = loop.time() - t0
                wait = frame_duration - elapsed
                if wait > 0:
                    await asyncio.sleep(wait)
        except asyncio.IncompleteReadError:
            logger.info("[Bot] Video stream finished")
            if self._video_published and self._video_sid:
                try:
                    await self.room.local_participant.unpublish_track(self._video_sid)
                except Exception as e:
                    logger.warning("[Bot] Failed to unpublish video track: %s", e)
                self._video_published = False
                self._video_source = None
                self._video_sid = None
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Bot] Video stream error")

    # ── Internal helpers ──────────────────────────────────────────────────────
    async def _stop_streams(self) -> None:
        for task in (self._audio_task, self._video_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        for proc in (self._ffmpeg_audio, self._ffmpeg_video):
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass

        self._audio_task = self._video_task = None
        self._ffmpeg_audio = self._ffmpeg_video = None

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

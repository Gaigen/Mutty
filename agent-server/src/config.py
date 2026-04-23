"""Environment-based configuration."""

import os
import re
import ipaddress
from urllib.parse import urlparse

# ── LiveKit ───────────────────────────────────────────────────────────────────
LIVEKIT_URL = os.getenv("LIVEKIT_WS_URL", "ws://livekit:7880")

# ── Bot identity ──────────────────────────────────────────────────────────────
AGENT_NAME = "youtube-bot"
BOT_IDENTITY = "youtube-bot"
BOT_NAME = os.getenv("BOT_NAME", "i meen to go away").strip() or "i meen to go away"

# ── Media proxy (yt-dlp / ffmpeg only) ────────────────────────────────────────
MEDIA_PROXY = os.getenv("AGENT_MEDIA_PROXY", "").strip() or None

# ── Audio ─────────────────────────────────────────────────────────────────────
AUDIO_SAMPLE_RATE = 48_000
AUDIO_CHANNELS = 2
AUDIO_SAMPLES_PER_FRAME = 960  # 20 ms at 48 kHz

# ── Video ─────────────────────────────────────────────────────────────────────
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

# ── Source classification ─────────────────────────────────────────────────────
_YOUTUBE_DOMAINS = ("youtube.com", "youtu.be", "www.youtube.com", "m.youtube.com")
_TWITCH_DOMAINS = ("twitch.tv", "www.twitch.tv", "m.twitch.tv", "clips.twitch.tv")
_SOUNDCLOUD_DOMAINS = ("soundcloud.com", "on.soundcloud.com")
_TELEGRAM_DOMAINS = ("t.me", "telegram.me", "telegram.org")

_AUDIO_ONLY_SOURCES = ("soundcloud",)

# ── Regex ─────────────────────────────────────────────────────────────────────
URL_RE = re.compile(r"https?://\S+")
STOP_RE = re.compile(r"^(?:!?\s*)?(стоп|stop)\s*$", re.IGNORECASE)
SKIP_RE = re.compile(r"^(?:!?\s*)?(skip|next|скип)\s*$", re.IGNORECASE)
QUEUE_CMD_RE = re.compile(r"^(?:!?\s*)?(?:add|queue|добавить|очередь)\s+(.+)", re.IGNORECASE)
QUEUE_LIST_RE = re.compile(r"^(?:!?\s*)?(?:queue|list|очередь|список)\s*$", re.IGNORECASE)
CLEAR_RE = re.compile(r"^(?:!?\s*)?(?:clear|очистить)\s*$", re.IGNORECASE)
SHUFFLE_RE = re.compile(r"^(?:!?\s*)?(?:shuffle|перемешать|шаффл)\s*$", re.IGNORECASE)
AUDIO_CMD_RE = re.compile(r"^(?:!?\s*)?аудио\s+(https?://\S+)", re.IGNORECASE)
VIDEO_CMD_RE = re.compile(r"^(?:!?\s*)?видео\s+(https?://\S+)", re.IGNORECASE)
YT_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:yt|youtube|ютуб)\s+(.+)$", re.IGNORECASE)
SC_SEARCH_RE = re.compile(r"^(?:!?\s*)?(?:sc|soundcloud|саундклауд)\s+(.+)$", re.IGNORECASE)

# AI commands
AI_CHAT_RE = re.compile(r"^(?:!?\s*)?(?:ai|джарвис|jarvis|бот|bot)\s+(.+)$", re.IGNORECASE)
AI_PLAYLIST_RE = re.compile(r"^(?:!?\s*)?(?:playlist|плейлист|playlist|плэйлист)\s+(.+)$", re.IGNORECASE)

AGENT_CONTROL_TOPIC = "agent-control"


# ── Helpers ───────────────────────────────────────────────────────────────────
def is_url_safe_for_media(url: str) -> bool:
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


def classify_source(url: str) -> str:
    """Return short source name: youtube / twitch / soundcloud / telegram / other."""
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


def is_audio_only_source(source: str) -> bool:
    return source in _AUDIO_ONLY_SOURCES


def subprocess_env_for_media() -> dict:
    """Environment dict for yt-dlp / ffmpeg. Does NOT mutate os.environ."""
    env = dict(os.environ)
    if MEDIA_PROXY:
        env["HTTP_PROXY"] = MEDIA_PROXY
        env["HTTPS_PROXY"] = MEDIA_PROXY
        env["http_proxy"] = MEDIA_PROXY
        env["https_proxy"] = MEDIA_PROXY
    return env

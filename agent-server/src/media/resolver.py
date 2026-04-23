"""yt-dlp media URL resolution and metadata fetching."""

import asyncio
import logging
from typing import Optional

from ..config import (
    DEFAULT_QUALITY,
    MEDIA_PROXY,
    QUALITY_PRESETS,
    subprocess_env_for_media,
)

logger = logging.getLogger(__name__)


def _yt_extra() -> list[str]:
    return ["--proxy", MEDIA_PROXY] if MEDIA_PROXY else []


def _format_spec(height: int) -> str:
    return (
        f"bestvideo[height<={height}][ext=mp4]+bestaudio[ext=m4a]"
        f"/bestvideo[height<={height}]+bestaudio"
        f"/best[height<={height}]/best"
    )


async def resolve(url: str) -> tuple[str, str, str, str]:
    """
    Resolve a media URL via yt-dlp.

    Returns:
        (video_url, audio_url, title, webpage_url)
    """
    _, height = QUALITY_PRESETS.get(DEFAULT_QUALITY, QUALITY_PRESETS["720p"])
    extra = _yt_extra()

    proc = await asyncio.create_subprocess_exec(
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        *extra,
        "-f",
        _format_spec(height),
        "--get-url",
        url,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=subprocess_env_for_media(),
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    lines = [ln for ln in stdout.decode().strip().splitlines() if ln.startswith("http")]
    if not lines:
        raise RuntimeError(stderr.decode()[:200] or "yt-dlp returned empty result")

    video_url = lines[0]
    audio_url = lines[1] if len(lines) >= 2 else lines[0]

    title, webpage_url = await _fetch_meta(url, extra)
    return video_url, audio_url, title, webpage_url


async def _fetch_meta(url: str, extra: list[str]) -> tuple[str, str]:
    """Fetch title and webpage_url in parallel."""
    title = ""
    webpage_url = url if url.startswith("http") else ""

    async def get_title() -> str:
        p = await asyncio.create_subprocess_exec(
            "yt-dlp",
            "--no-playlist",
            *extra,
            "--get-title",
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=subprocess_env_for_media(),
        )
        out, _ = await asyncio.wait_for(p.communicate(), timeout=15)
        return out.decode().strip()

    async def get_link() -> str:
        p = await asyncio.create_subprocess_exec(
            "yt-dlp",
            "--no-playlist",
            *extra,
            "--print",
            "webpage_url",
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=subprocess_env_for_media(),
        )
        out, _ = await asyncio.wait_for(p.communicate(), timeout=15)
        return out.decode().strip()

    try:
        t, link = await asyncio.gather(get_title(), get_link())
        if t:
            title = t
        if link.startswith("http"):
            webpage_url = link
    except Exception:
        pass

    return title, webpage_url

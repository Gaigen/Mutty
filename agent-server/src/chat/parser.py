"""Text command parser for chat messages."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from ..config import (
    AI_CHAT_RE,
    AI_PLAYLIST_RE,
    AUDIO_CMD_RE,
    CLEAR_RE,
    QUEUE_CMD_RE,
    QUEUE_LIST_RE,
    SC_SEARCH_RE,
    SHUFFLE_RE,
    SKIP_RE,
    STOP_RE,
    URL_RE,
    VIDEO_CMD_RE,
    YT_SEARCH_RE,
    is_url_safe_for_media,
)


@dataclass(frozen=True)
class Command:
    action: str
    url: Optional[str] = None
    query: Optional[str] = None
    mode: Optional[str] = None


def parse(text: str) -> Optional[Command]:
    """Parse a chat line into a Command, or None if no command recognized."""
    t = text.strip()
    if not t:
        return None

    if STOP_RE.match(t):
        return Command("stop")

    if SKIP_RE.match(t):
        return Command("skip")

    m = QUEUE_CMD_RE.match(t)
    if m:
        arg = m.group(1).strip()
        return Command("queue_add", url=arg) if arg else None

    if QUEUE_LIST_RE.match(t):
        return Command("queue_list")

    if CLEAR_RE.match(t):
        return Command("queue_clear")

    if SHUFFLE_RE.match(t):
        return Command("queue_shuffle")

    m = AUDIO_CMD_RE.match(t)
    if m:
        url = m.group(1)
        return Command("play", url=url, mode="audio") if is_url_safe_for_media(url) else None

    m = VIDEO_CMD_RE.match(t)
    if m:
        url = m.group(1)
        return Command("play", url=url, mode="video") if is_url_safe_for_media(url) else None

    m = YT_SEARCH_RE.match(t)
    if m:
        q = m.group(1).strip()
        return Command("search_play", query=q, mode="video") if q else None

    m = SC_SEARCH_RE.match(t)
    if m:
        q = m.group(1).strip()
        return Command("search_play", query=q, mode="audio") if q else None

    # AI commands
    m = AI_CHAT_RE.match(t)
    if m:
        q = m.group(1).strip()
        return Command("ai_chat", query=q) if q else None

    m = AI_PLAYLIST_RE.match(t)
    if m:
        q = m.group(1).strip()
        return Command("ai_playlist", query=q) if q else None

    match = URL_RE.search(t)
    if match:
        url = match.group(0)
        if is_url_safe_for_media(url):
            return Command("play", url=url)

    return None

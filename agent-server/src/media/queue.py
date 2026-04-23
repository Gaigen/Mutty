"""Playback queue management."""

import random
from collections import deque
from typing import Optional

from ..config import classify_source


class PlaybackQueue:
    def __init__(self) -> None:
        self._queue: deque[str] = deque()
        self._meta: dict[str, tuple[str, str]] = {}  # url -> (title, webpage_url)

    # ── Properties ──────────────────────────────────────────────────────────
    @property
    def items(self) -> list[str]:
        return list(self._queue)

    @property
    def length(self) -> int:
        return len(self._queue)

    def is_empty(self) -> bool:
        return len(self._queue) == 0

    # ── Mutations ───────────────────────────────────────────────────────────
    def add(self, url: str) -> None:
        self._queue.append(url)

    def add_front(self, url: str) -> None:
        self._queue.appendleft(url)

    def pop_next(self) -> Optional[str]:
        return self._queue.popleft() if self._queue else None

    def clear(self) -> int:
        n = len(self._queue)
        self._queue.clear()
        return n

    def shuffle(self) -> bool:
        if len(self._queue) < 2:
            return False
        items = list(self._queue)
        random.shuffle(items)
        self._queue = deque(items)
        return True

    # ── Metadata cache ──────────────────────────────────────────────────────
    def cache_meta(self, url: str, title: str, link: str) -> None:
        self._meta[url] = (title or url, link or url)

    def get_meta(self, url: str) -> Optional[tuple[str, str]]:
        return self._meta.get(url)

    # ── Display helpers ─────────────────────────────────────────────────────
    def display(self, limit: int = 10, max_title: int = 45) -> list[tuple[str, str]]:
        """Return (display_title, link) tuples for UI hyperlinks."""
        out: list[tuple[str, str]] = []
        for url in list(self._queue)[:limit]:
            meta = self._meta.get(url)
            if meta:
                title, link = meta
                display = (title[:max_title] + "…") if len(title) > max_title else title
                out.append((display, link))
            elif url.startswith("ytsearch"):
                _, _, rest = url.partition(":")
                q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
                link = f"https://www.youtube.com/results?search_query={rest}"
                out.append((f"🔍 {q}", link))
            elif url.startswith("scsearch"):
                _, _, rest = url.partition(":")
                q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
                link = f"https://soundcloud.com/search?q={rest}"
                out.append((f"🔍 SC {q}", link))
            elif url.startswith("http"):
                short = url[:max_title] + ("…" if len(url) > max_title else "")
                out.append((short, url))
            else:
                short = url[:max_title] + ("…" if len(url) > max_title else "")
                out.append((short, ""))
        return out

    def format_line(self, index: int, url: str, max_title: int = 50) -> str:
        """Markdown-style line for chat output."""
        meta = self._meta.get(url)
        if meta:
            title, link = meta
            display = (title[:max_title] + "…") if len(title) > max_title else title
            return f"  {index}. [{display}]({link})"
        if url.startswith("ytsearch"):
            _, _, rest = url.partition(":")
            q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
            link = f"https://www.youtube.com/results?search_query={rest}"
            return f"  {index}. 🔍 [{q}]({link})"
        if url.startswith("scsearch"):
            _, _, rest = url.partition(":")
            q = rest[:max_title] + ("…" if len(rest) > max_title else rest)
            link = f"https://soundcloud.com/search?q={rest}"
            return f"  {index}. 🔍 SC [{q}]({link})"
        if url.startswith("http"):
            short = url[:max_title] + ("…" if len(url) > max_title else "")
            return f"  {index}. [{short}]({url})"
        short = url[:max_title] + ("…" if len(url) > max_title else "")
        return f"  {index}. {short}"

"""AI chat plugin — OpenRouter-based assistant, search, and playlist generation."""

import asyncio
import logging
from typing import Callable, Optional

from ..llm.base import LLMProvider
from ..memory import MemoryStore

logger = logging.getLogger(__name__)


class AIChatManager:
    """Handles AI conversations, search translation, and playlist generation."""

    def __init__(
        self,
        llm: Optional[LLMProvider],
        chat_send: Callable[[str], asyncio.Future],
        memory: Optional[MemoryStore],
    ) -> None:
        self._llm = llm
        self._chat_send = chat_send
        self._memory = memory

    # ── Chat ──────────────────────────────────────────────────────────────────
    async def chat(self, message: str, room_name: str) -> None:
        if not self._llm:
            await self._chat_send("🤖 AI не настроен. Добавь OPENROUTER_API_KEY в env.")
            return
        try:
            from ..llm.prompts import ASSISTANT_SYSTEM
            from ..llm.base import LLMMessage

            msgs = [LLMMessage(role="system", content=ASSISTANT_SYSTEM)]
            if self._memory:
                history = self._memory.get_history(room_name, limit=10)
                msgs.extend(history)
            msgs.append(LLMMessage(role="user", content=message))

            resp = await self._llm.complete(msgs, max_tokens=256)
            text = resp.content.strip()
            if not text:
                return

            if text.upper().startswith("PLAY:"):
                query = text[5:].strip()
                await self._chat_send(f"🔍 AI ищет: {query}")
                # Delegate back to caller (media manager)
                await self._chat_send(f"__PLAY__:{query}")
                if self._memory:
                    self._memory.add_history(room_name, "assistant", f"🤖 (play) {query}")
                return

            await self._chat_send(f"🤖 {text}")
            if self._memory:
                self._memory.add_history(room_name, "assistant", text)
        except Exception as exc:
            logger.warning("[AI] Chat error: %s", exc)
            await self._chat_send("❌ Ошибка AI, попробуй ещё.")

    # ── Search translation ────────────────────────────────────────────────────
    async def search(self, query: str) -> Optional[str]:
        if not self._llm:
            return None
        try:
            from ..llm.prompts import SEARCH_SYSTEM
            from ..llm.base import LLMMessage

            msgs = [
                LLMMessage(role="system", content=SEARCH_SYSTEM),
                LLMMessage(role="user", content=query),
            ]
            resp = await self._llm.complete(msgs, max_tokens=64)
            result = resp.content.strip()
            return result if result else None
        except Exception as exc:
            logger.warning("[AI] Search error: %s", exc)
            return None

    # ── Playlist generation ───────────────────────────────────────────────────
    async def playlist(self, query: str, room_name: str) -> list[str]:
        if not self._llm:
            await self._chat_send("🤖 AI не настроен. Добавь OPENROUTER_API_KEY в env.")
            return []
        try:
            from ..llm.prompts import PLAYLIST_SYSTEM
            from ..llm.base import LLMMessage

            msgs = [
                LLMMessage(role="system", content=PLAYLIST_SYSTEM),
                LLMMessage(role="user", content=query),
            ]
            resp = await self._llm.complete(msgs, max_tokens=256)
            lines = [ln.strip() for ln in resp.content.strip().splitlines() if ln.strip() and " - " in ln]
            if not lines:
                await self._chat_send("🤖 AI не смог составить плейлист. Попробуй переформулировать.")
                return []

            await self._chat_send(f"🎵 AI плейлист ({len(lines)} треков):\n" + "\n".join(f"  {ln}" for ln in lines))
            if self._memory:
                for ln in lines:
                    self._memory.add_history(room_name, "assistant", f"🎵 {ln}")
            return lines
        except Exception as exc:
            logger.warning("[AI] Playlist error: %s", exc)
            await self._chat_send("❌ AI плейлист не сработал.")
            return []

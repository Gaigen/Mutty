"""LiveKit chat gateway — send messages compatible with @livekit/components-react useChat()."""

import json
import logging
import time
import uuid
from typing import Optional

from livekit import rtc

logger = logging.getLogger(__name__)


class ChatGateway:
    """Sends chat messages that appear in the LiveKit Components chat UI."""

    def __init__(self, room: rtc.Room) -> None:
        self._room = room

    async def send(self, message: str) -> None:
        if self._room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            logger.warning("[ChatGateway] Not connected, cannot send")
            return
        try:
            # Use send_text (text stream) with topic "lk.chat" — this is what
            # @livekit/components-react useChat() listens for via setupChat().
            await self._room.local_participant.send_text(
                message,
                topic="lk.chat",
                attributes={
                    "lk.chat.message.id": uuid.uuid4().hex[:8],
                    "lk.chat.message.timestamp": str(int(time.time() * 1000)),
                },
            )
            logger.info("[ChatGateway] Sent text stream: %s", message[:80])
        except Exception as exc:
            logger.warning("[ChatGateway] Failed to send message: %s", exc)

    async def welcome(self) -> None:
        await self.send(
            "👋 Bot connected!\n"
            "📎 Paste a link to play  •  add <url> to queue  •  youtube <query> to search\n"
            "skip — next track  •  shuffle — randomize  •  clear — empty queue  •  queue — list"
        )

    async def goodbye(self) -> None:
        await self.send("👋 Bot disconnected.")

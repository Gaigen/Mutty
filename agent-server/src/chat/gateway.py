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
            return
        payload = json.dumps({
            "id": uuid.uuid4().hex[:8],
            "timestamp": int(time.time() * 1000),
            "message": message,
        }).encode()
        try:
            # topic="" is required for @livekit/components-react useChat() to receive it.
            # Custom topics (e.g. "lk-chat-topic") are ignored by the built-in chat hook.
            await self._room.local_participant.publish_data(
                payload,
                reliable=True,
                topic="",
            )
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

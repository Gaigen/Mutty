"""Ephemeral in-memory storage — dies when bot leaves the room."""

import time
from typing import Optional

from ..llm.base import LLMMessage


class MemoryStore:
    """
    In-memory session storage. NOTHING is persisted to disk.

    Each room gets its own bucket.  When the bot leaves,
    call drop_room() and the bucket vanishes forever.
    """

    def __init__(self) -> None:
        # room -> { history: [...], prefs: { (identity,key): value }, state: dict }
        self._data: dict[str, dict] = {}

    def _bucket(self, room: str) -> dict:
        if room not in self._data:
            self._data[room] = {"history": [], "prefs": {}, "state": {}}
        return self._data[room]

    # ── History ─────────────────────────────────────────────────────────────
    def add_history(self, room: str, role: str, message: str, identity: Optional[str] = None) -> None:
        """Append a message to the room's ephemeral history."""
        self._bucket(room)["history"].append({
            "timestamp": time.time(),
            "identity": identity,
            "role": role,
            "message": message,
        })

    def get_history(self, room: str, limit: int = 20) -> list[LLMMessage]:
        """Return recent history as LLM messages (oldest → newest)."""
        hist = self._bucket(room)["history"]
        msgs: list[LLMMessage] = []
        for entry in hist[-limit:]:
            content = entry["message"]
            if entry["identity"] and entry["role"] == "user":
                content = f"[{entry['identity']}] {content}"
            msgs.append(LLMMessage(role=entry["role"], content=content))
        return msgs

    def clear_history(self, room: str) -> None:
        self._bucket(room)["history"] = []

    # ── User preferences (per-room, still ephemeral) ─────────────────────────
    def set_pref(self, room: str, identity: str, key: str, value: str) -> None:
        self._bucket(room)["prefs"][(identity, key)] = {
            "value": value,
            "updated_at": time.time(),
        }

    def get_pref(self, room: str, identity: str, key: str) -> Optional[str]:
        entry = self._bucket(room)["prefs"].get((identity, key))
        return entry["value"] if entry else None

    def get_user_prefs(self, room: str, identity: str) -> dict[str, str]:
        prefs = self._bucket(room)["prefs"]
        return {
            k[1]: v["value"]
            for k, v in prefs.items()
            if k[0] == identity
        }

    # ── Room state (ephemeral snapshot) ──────────────────────────────────────
    def save_room_state(self, room: str, snapshot: dict) -> None:
        """Keep a snapshot while the bot is in the room."""
        self._bucket(room)["state"] = snapshot

    def load_room_state(self, room: str) -> Optional[dict]:
        """Restore snapshot only while the bot is still in the room."""
        return self._bucket(room)["state"] or None

    # ── Cleanup ──────────────────────────────────────────────────────────────
    def drop_room(self, room: str) -> None:
        """Delete everything for this room. Call on disconnect."""
        self._data.pop(room, None)

    def close(self) -> None:
        """Nuke everything."""
        self._data.clear()

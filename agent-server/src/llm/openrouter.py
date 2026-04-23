"""OpenRouter LLM provider implementation (stub / prepared structure)."""

import os
import logging
from typing import AsyncIterator, Optional

from .base import LLMProvider, LLMMessage, LLMResponse

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterProvider(LLMProvider):
    """
    OpenRouter API provider.

    Set OPENROUTER_API_KEY env var.
    Optional: OPENROUTER_MODEL (default: openai/gpt-4o-mini)
    Optional: OPENROUTER_HTTP_REFERER and OPENROUTER_SITE_NAME for rankings.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self._api_key = (api_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
        self._model = (model or os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)).strip() or DEFAULT_MODEL
        self._referer = os.getenv("OPENROUTER_HTTP_REFERER", "").strip()
        self._site_name = os.getenv("OPENROUTER_SITE_NAME", "").strip()

        if not self._api_key:
            logger.warning("[OpenRouter] API key is not set. LLM features will be disabled.")

    def _headers(self) -> dict[str, str]:
        h = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        if self._referer:
            h["HTTP-Referer"] = self._referer
        if self._site_name:
            h["X-Title"] = self._site_name
        return h

    def _payload(self, messages: list[LLMMessage], stream: bool = False, **kwargs) -> dict:
        return {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
            **kwargs,
        }

    async def complete(self, messages: list[LLMMessage], **kwargs) -> LLMResponse:
        """Non-streaming completion. Requires `httpx` or `aiohttp`."""
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx is required for OpenRouter. Install: pip install httpx") from exc

        if not self._api_key:
            return LLMResponse(content="", finish_reason="error")

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{BASE_URL}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, stream=False, **kwargs),
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()
        choice = data.get("choices", [{}])[0]
        return LLMResponse(
            content=choice.get("message", {}).get("content", ""),
            finish_reason=choice.get("finish_reason"),
            usage=data.get("usage"),
        )

    async def stream(self, messages: list[LLMMessage], **kwargs) -> AsyncIterator[str]:
        """Streaming completion via SSE."""
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx is required for OpenRouter. Install: pip install httpx") from exc

        if not self._api_key:
            return

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{BASE_URL}/chat/completions",
                headers=self._headers(),
                json=self._payload(messages, stream=True, **kwargs),
                timeout=60.0,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        break
                    try:
                        import json
                        chunk = json.loads(payload)
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        continue

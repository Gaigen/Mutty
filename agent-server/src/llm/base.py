"""Base LLM provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass(frozen=True)
class LLMMessage:
    role: str  # "system", "user", "assistant", "tool"
    content: str
    name: Optional[str] = None


@dataclass(frozen=True)
class LLMResponse:
    content: str
    finish_reason: Optional[str] = None
    usage: Optional[dict] = None


class LLMProvider(ABC):
    """Abstract LLM provider. Implement for OpenRouter, OpenAI, local models, etc."""

    @abstractmethod
    async def complete(self, messages: list[LLMMessage], **kwargs) -> LLMResponse:
        """Send a chat completion request and return the full response."""
        ...

    @abstractmethod
    async def stream(self, messages: list[LLMMessage], **kwargs) -> AsyncIterator[str]:
        """Stream completion tokens as they arrive."""
        ...

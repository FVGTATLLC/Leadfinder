import json
import logging

from anthropic import AsyncAnthropic

from app.agents.llm.provider import LLMProvider, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


class ClaudeProvider(LLMProvider):
    """Anthropic Claude LLM provider."""

    def __init__(self) -> None:
        self.client = AsyncAnthropic(
            api_key=settings.CLAUDE_API_KEY,
            max_retries=MAX_RETRIES,
        )

    async def complete(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> LLMResponse:
        system_message = None
        chat_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                chat_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        kwargs: dict = {
            "model": model,
            "messages": chat_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if system_message:
            kwargs["system"] = system_message

        try:
            response = await self.client.messages.create(**kwargs)

            content = ""
            for block in response.content:
                if hasattr(block, "text"):
                    content += block.text

            tokens_used = (
                response.usage.input_tokens + response.usage.output_tokens
            )

            return LLMResponse(
                content=content,
                tokens_used=tokens_used,
                model=response.model,
                finish_reason=response.stop_reason or "end_turn",
            )
        except Exception as e:
            logger.error("Claude completion failed: %s", str(e))
            raise

    async def complete_structured(
        self,
        messages: list[dict],
        model: str,
        schema: dict,
    ) -> dict:
        system_message = None
        chat_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                chat_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        tool_definition = {
            "name": "structured_output",
            "description": "Return structured data matching the required schema.",
            "input_schema": schema,
        }

        kwargs: dict = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": 4096,
            "tools": [tool_definition],
            "tool_choice": {"type": "tool", "name": "structured_output"},
        }
        if system_message:
            kwargs["system"] = system_message

        try:
            response = await self.client.messages.create(**kwargs)

            for block in response.content:
                if hasattr(block, "input"):
                    return block.input

            content = ""
            for block in response.content:
                if hasattr(block, "text"):
                    content += block.text
            return json.loads(content)
        except Exception as e:
            logger.error("Claude structured completion failed: %s", str(e))
            raise

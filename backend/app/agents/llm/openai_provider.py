import json
import logging

from openai import AsyncOpenAI

from app.agents.llm.provider import LLMProvider, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
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
        kwargs: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        try:
            response = await self.client.chat.completions.create(**kwargs)

            choice = response.choices[0]
            content = choice.message.content or ""

            tokens_used = 0
            if response.usage:
                tokens_used = (
                    response.usage.prompt_tokens + response.usage.completion_tokens
                )

            return LLMResponse(
                content=content,
                tokens_used=tokens_used,
                model=response.model,
                finish_reason=choice.finish_reason or "stop",
            )
        except Exception as e:
            logger.error("OpenAI completion failed: %s", str(e))
            raise

    async def complete_structured(
        self,
        messages: list[dict],
        model: str,
        schema: dict,
    ) -> dict:
        instruction = (
            "You must respond with valid JSON matching this schema:\n"
            f"{json.dumps(schema, indent=2)}"
        )

        augmented_messages = []
        system_found = False
        for msg in messages:
            if msg["role"] == "system":
                augmented_messages.append({
                    "role": "system",
                    "content": f"{msg['content']}\n\n{instruction}",
                })
                system_found = True
            else:
                augmented_messages.append(msg)

        if not system_found:
            augmented_messages.insert(0, {
                "role": "system",
                "content": instruction,
            })

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=augmented_messages,
                temperature=0.2,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            return json.loads(content)
        except Exception as e:
            logger.error("OpenAI structured completion failed: %s", str(e))
            raise

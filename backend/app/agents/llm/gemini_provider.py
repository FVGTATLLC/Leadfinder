import json
import logging

from google import genai
from google.genai import types

from app.agents.llm.provider import LLMProvider, LLMResponse
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider."""

    def __init__(self) -> None:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def complete(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: dict | None = None,
    ) -> LLMResponse:
        # Build Gemini content format
        system_instruction = None
        contents = []

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=msg["content"])],
                    )
                )

        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        try:
            response = await self.client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )

            content = response.text or ""
            tokens_used = 0
            if response.usage_metadata:
                tokens_used = (
                    (response.usage_metadata.prompt_token_count or 0)
                    + (response.usage_metadata.candidates_token_count or 0)
                )

            return LLMResponse(
                content=content,
                tokens_used=tokens_used,
                model=model,
                finish_reason=response.candidates[0].finish_reason.name if response.candidates else "stop",
            )
        except Exception as e:
            logger.error("Gemini completion failed: %s", str(e))
            raise

    async def complete_structured(
        self,
        messages: list[dict],
        model: str,
        schema: dict,
    ) -> dict:
        # Build content with schema instruction
        system_instruction = None
        contents = []

        for msg in messages:
            if msg["role"] == "system":
                system_instruction = msg["content"]
            else:
                role = "user" if msg["role"] == "user" else "model"
                content_text = msg["content"]
                if msg["role"] == "user":
                    content_text += (
                        f"\n\nYou MUST respond with valid JSON matching this schema:\n"
                        f"{json.dumps(schema, indent=2)}"
                    )
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=content_text)],
                    )
                )

        config = types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
        if system_instruction:
            config.system_instruction = system_instruction

        try:
            response = await self.client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )

            content = response.text or ""
            # Clean up potential markdown code blocks
            if content.startswith("```"):
                content = content.strip("`").strip()
                if content.startswith("json"):
                    content = content[4:].strip()

            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error("Gemini structured output JSON parse failed: %s", str(e))
            raise
        except Exception as e:
            logger.error("Gemini structured completion failed: %s", str(e))
            raise

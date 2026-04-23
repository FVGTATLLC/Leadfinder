import logging

from app.agents.llm.claude_provider import ClaudeProvider
from app.agents.llm.config import TASK_MODEL_MAP
from app.agents.llm.gemini_provider import GeminiProvider
from app.agents.llm.openai_provider import OpenAIProvider
from app.agents.llm.provider import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class LLMRouter:
    """Routes LLM requests to the appropriate provider based on task type."""

    def __init__(self) -> None:
        self._providers: dict[str, LLMProvider] = {}

    def _get_provider_instance(self, provider_name: str) -> LLMProvider:
        """Get or create a cached provider instance."""
        if provider_name not in self._providers:
            if provider_name == "claude":
                self._providers[provider_name] = ClaudeProvider()
            elif provider_name == "openai":
                self._providers[provider_name] = OpenAIProvider()
            elif provider_name == "gemini":
                self._providers[provider_name] = GeminiProvider()
            else:
                raise ValueError(f"Unknown LLM provider: {provider_name}")
        return self._providers[provider_name]

    def get_provider(self, task_type: str) -> LLMProvider:
        """Get the configured LLM provider for a task type."""
        config = TASK_MODEL_MAP.get(task_type)
        if config is None:
            raise ValueError(f"Unknown task type: {task_type}")
        return self._get_provider_instance(config["provider"])

    async def complete(
        self,
        task_type: str,
        messages: list[dict],
        **kwargs,
    ) -> LLMResponse:
        """
        Route a completion request to the appropriate provider.

        Falls back to secondary provider if primary fails.
        """
        config = TASK_MODEL_MAP.get(task_type)
        if config is None:
            raise ValueError(f"Unknown task type: {task_type}")

        model = kwargs.pop("model", config["model"])
        temperature = kwargs.pop("temperature", config["temperature"])
        max_tokens = kwargs.pop("max_tokens", config.get("max_tokens", 4096))

        primary_provider = self._get_provider_instance(config["provider"])

        try:
            return await primary_provider.complete(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            )
        except Exception as primary_error:
            logger.warning(
                "Primary provider '%s' failed for task '%s': %s. Attempting fallback.",
                config["provider"],
                task_type,
                str(primary_error),
            )

            fallback_provider_name = config.get("fallback_provider")
            fallback_model = config.get("fallback_model")

            if not fallback_provider_name or not fallback_model:
                raise

            try:
                fallback_provider = self._get_provider_instance(
                    fallback_provider_name
                )
                return await fallback_provider.complete(
                    messages=messages,
                    model=fallback_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs,
                )
            except Exception as fallback_error:
                logger.error(
                    "Fallback provider '%s' also failed for task '%s': %s",
                    fallback_provider_name,
                    task_type,
                    str(fallback_error),
                )
                raise primary_error from fallback_error

    async def complete_structured(
        self,
        task_type: str,
        messages: list[dict],
        schema: dict,
    ) -> dict:
        """
        Route a structured completion request to the appropriate provider.

        Falls back to secondary provider if primary fails.
        """
        config = TASK_MODEL_MAP.get(task_type)
        if config is None:
            raise ValueError(f"Unknown task type: {task_type}")

        primary_provider = self._get_provider_instance(config["provider"])

        try:
            return await primary_provider.complete_structured(
                messages=messages,
                model=config["model"],
                schema=schema,
            )
        except Exception as primary_error:
            logger.warning(
                "Primary provider '%s' structured call failed for task '%s': %s",
                config["provider"],
                task_type,
                str(primary_error),
            )

            fallback_provider_name = config.get("fallback_provider")
            fallback_model = config.get("fallback_model")

            if not fallback_provider_name or not fallback_model:
                raise

            try:
                fallback_provider = self._get_provider_instance(
                    fallback_provider_name
                )
                return await fallback_provider.complete_structured(
                    messages=messages,
                    model=fallback_model,
                    schema=schema,
                )
            except Exception as fallback_error:
                logger.error(
                    "Fallback provider '%s' structured call also failed for '%s': %s",
                    fallback_provider_name,
                    task_type,
                    str(fallback_error),
                )
                raise primary_error from fallback_error

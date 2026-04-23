TASK_MODEL_MAP: dict[str, dict] = {
    "discovery": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.7,
        "max_tokens": 4096,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "persona_mapping": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.5,
        "max_tokens": 4096,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "research": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "max_tokens": 4096,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "messaging_intro": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.8,
        "max_tokens": 2048,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "messaging_followup": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.8,
        "max_tokens": 2048,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "analytics_insight": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.3,
        "max_tokens": 2048,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
    "global_clients": {
        "provider": "gemini",
        "model": "gemini-2.5-flash-lite",
        "temperature": 0.5,
        "max_tokens": 4096,
        "fallback_provider": "claude",
        "fallback_model": "claude-sonnet-4-20250514",
    },
}

MODEL_CONFIGS: dict[str, dict] = {
    "claude-sonnet-4-20250514": {
        "max_context_tokens": 200000,
        "max_output_tokens": 8192,
        "input_price_per_1k": 0.003,
        "output_price_per_1k": 0.015,
    },
    "claude-haiku-4-20250514": {
        "max_context_tokens": 200000,
        "max_output_tokens": 4096,
        "input_price_per_1k": 0.00025,
        "output_price_per_1k": 0.00125,
    },
    "gpt-4o": {
        "max_context_tokens": 128000,
        "max_output_tokens": 4096,
        "input_price_per_1k": 0.005,
        "output_price_per_1k": 0.015,
    },
    "gpt-4o-mini": {
        "max_context_tokens": 128000,
        "max_output_tokens": 4096,
        "input_price_per_1k": 0.00015,
        "output_price_per_1k": 0.0006,
    },
    "gemini-2.5-flash-lite": {
        "max_context_tokens": 1048576,
        "max_output_tokens": 8192,
        "input_price_per_1k": 0.000075,
        "output_price_per_1k": 0.0003,
    },
    "gemini-2.5-pro-preview-06-05": {
        "max_context_tokens": 1048576,
        "max_output_tokens": 65536,
        "input_price_per_1k": 0.00125,
        "output_price_per_1k": 0.01,
    },
}

DEFAULT_TEMPERATURES: dict[str, float] = {
    "discovery": 0.7,
    "persona_mapping": 0.5,
    "research": 0.3,
    "messaging_intro": 0.8,
    "messaging_followup": 0.8,
    "analytics_insight": 0.3,
    "global_clients": 0.5,
}

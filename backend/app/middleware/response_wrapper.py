"""Middleware to wrap JSON responses and convert keys to camelCase.

The frontend expects:
  1. All JSON keys in camelCase (backend uses snake_case)
  2. Non-paginated responses wrapped in {"data": T}
  3. Paginated responses as-is (but still camelCase keys)

Skips:
  - Auth endpoints (handled directly by NextAuth with raw fetch)
  - 204 No Content responses (no body)
  - Health check endpoint
  - Non-JSON responses
"""

import json
import re

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def _snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase."""
    components = name.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def _convert_keys(obj: object) -> object:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {_snake_to_camel(k): _convert_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_keys(item) for item in obj]
    return obj


class ResponseWrapperMiddleware(BaseHTTPMiddleware):
    # Routes that should NOT be wrapped or converted
    SKIP_PREFIXES = ("/api/v1/auth/", "/health")

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        response = await call_next(request)

        # Only process successful JSON responses
        if not (200 <= response.status_code < 300):
            return response

        if response.status_code == 204:
            return response

        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return response

        path = request.url.path
        if any(path.startswith(prefix) for prefix in self.SKIP_PREFIXES):
            return response

        # Read the response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        try:
            data = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type="application/json",
            )

        # Convert all keys to camelCase
        data = _convert_keys(data)

        # Paginated responses (have items + total keys) – return as-is (no wrapping)
        if isinstance(data, dict) and "items" in data and "total" in data:
            result = json.dumps(data)
        else:
            # Wrap in {"data": ...}
            result = json.dumps({"data": data})

        return Response(
            content=result,
            status_code=response.status_code,
            media_type="application/json",
        )

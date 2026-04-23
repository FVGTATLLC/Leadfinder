"""
JWT authentication helpers for FastAPI.

The primary auth logic lives in app/dependencies.py (get_current_user, require_role).
This module provides additional helper functions for token-related operations.
"""

from datetime import datetime, timezone

from app.exceptions import UnauthorizedError
from app.schemas.user import TokenPayload
from app.services.auth_service import decode_token


def extract_token_from_header(authorization: str | None) -> str:
    """Extract the bearer token from an Authorization header value."""
    if authorization is None:
        raise UnauthorizedError("Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Invalid authorization scheme. Expected 'Bearer <token>'")
    return token


def validate_token(token: str) -> TokenPayload:
    """Decode and validate a JWT token, checking expiration."""
    payload = decode_token(token)
    now = int(datetime.now(timezone.utc).timestamp())
    if payload.exp < now:
        raise UnauthorizedError("Token has expired")
    return payload


def check_role(payload: TokenPayload, allowed_roles: list[str]) -> None:
    """Check that the token payload's role is in the allowed roles list."""
    if payload.role not in allowed_roles:
        from app.exceptions import ForbiddenError

        raise ForbiddenError(
            f"Role '{payload.role}' is not authorized. Required: {allowed_roles}"
        )

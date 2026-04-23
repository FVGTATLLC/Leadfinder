import asyncio
from collections.abc import AsyncGenerator, Callable
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenError, UnauthorizedError
from app.schemas.user import TokenPayload
from app.services.auth_service import decode_token
from app.utils.database import get_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def _update_last_active(user_id: str) -> None:
    """Update last_active_at for a user in a separate session (fire and forget)."""
    try:
        from app.models.user import User

        session_factory = get_session_factory()
        async with session_factory() as session:
            stmt = (
                update(User)
                .where(User.id == user_id)
                .values(last_active_at=datetime.now(timezone.utc))
            )
            await session.execute(stmt)
            await session.commit()
    except Exception:
        pass  # Don't block the request if this fails


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> TokenPayload:
    if authorization is None:
        raise UnauthorizedError("Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Invalid authorization scheme. Expected 'Bearer <token>'")

    payload = decode_token(token)

    # Update last_active_at (fire and forget, don't block the request)
    asyncio.create_task(_update_last_active(payload.sub))

    return payload


def require_role(roles: list[str]) -> Callable[..., TokenPayload]:
    async def role_checker(
        current_user: Annotated[TokenPayload, Depends(get_current_user)],
    ) -> TokenPayload:
        if current_user.role not in roles:
            raise ForbiddenError(
                f"Role '{current_user.role}' is not authorized. Required: {roles}"
            )
        return current_user

    return role_checker

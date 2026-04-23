import logging
import uuid
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.models.activity_log import ActivityLog
from app.services.auth_service import decode_token
from app.utils.database import get_session_factory

logger = logging.getLogger(__name__)

AUDITED_METHODS = {"POST", "PATCH", "PUT", "DELETE"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        if request.method in AUDITED_METHODS and response.status_code < 400:
            try:
                await self._log_activity(request, response)
            except Exception:
                logger.exception("Failed to write audit log")

        return response

    async def _log_activity(self, request: Request, response: Response) -> None:
        user_id: str | None = None
        authorization = request.headers.get("authorization")
        if authorization:
            try:
                _, _, token = authorization.partition(" ")
                payload = decode_token(token)
                user_id = payload.sub
            except Exception:
                return  # Can't identify user; skip audit

        if user_id is None:
            return

        path = request.url.path
        action = f"{request.method} {path}"

        entity_type, entity_id = self._extract_entity(path)

        ip_address = request.client.host if request.client else None

        session_factory = get_session_factory()
        async with session_factory() as session:
            log_entry = ActivityLog(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                details={"status_code": response.status_code, "path": path},
                ip_address=ip_address,
            )
            session.add(log_entry)
            await session.commit()

    @staticmethod
    def _extract_entity(path: str) -> tuple[str, uuid.UUID]:
        """Extract entity type and id from URL path. Returns defaults for non-resource paths."""
        parts = [p for p in path.strip("/").split("/") if p]
        entity_type = "unknown"
        entity_id = uuid.UUID(int=0)

        # Try to find a resource pattern like /api/v1/users/{uuid}
        for i, part in enumerate(parts):
            try:
                entity_id = uuid.UUID(part)
                if i > 0:
                    entity_type = parts[i - 1]
                break
            except ValueError:
                continue

        # If no UUID found in path, use the last segment as entity_type
        if entity_id == uuid.UUID(int=0) and parts:
            entity_type = parts[-1]

        return entity_type, entity_id

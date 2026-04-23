from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db, require_role
from app.schemas.user import TokenPayload

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsResponse(BaseModel):
    smtp_configured: bool
    gcs_configured: bool
    llm_providers: list[str]
    enrichment_sources: list[str]
    cors_origins: list[str]


class SettingsUpdate(BaseModel):
    cors_origins: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None


class SettingsUpdateResponse(BaseModel):
    updated_fields: list[str]
    message: str


def _build_settings_response() -> SettingsResponse:
    llm_providers: list[str] = []
    if settings.CLAUDE_API_KEY:
        llm_providers.append("claude")
    if settings.OPENAI_API_KEY:
        llm_providers.append("openai")

    enrichment_sources: list[str] = []
    if settings.CLAUDE_API_KEY or settings.OPENAI_API_KEY:
        enrichment_sources.append("llm_enrichment")

    return SettingsResponse(
        smtp_configured=bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
        gcs_configured=bool(settings.GCS_BUCKET),
        llm_providers=llm_providers,
        enrichment_sources=enrichment_sources,
        cors_origins=settings.cors_origin_list,
    )


@router.get("", response_model=SettingsResponse)
async def get_settings(
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SettingsResponse:
    return _build_settings_response()


@router.patch("", response_model=SettingsUpdateResponse)
async def update_settings(
    data: SettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> SettingsUpdateResponse:
    updated_fields: list[str] = []

    update_data = data.model_dump(exclude_unset=True)

    if "cors_origins" in update_data and update_data["cors_origins"] is not None:
        settings.CORS_ORIGINS = update_data["cors_origins"]
        updated_fields.append("cors_origins")

    if "smtp_host" in update_data and update_data["smtp_host"] is not None:
        settings.SMTP_HOST = update_data["smtp_host"]
        updated_fields.append("smtp_host")

    if "smtp_port" in update_data and update_data["smtp_port"] is not None:
        settings.SMTP_PORT = update_data["smtp_port"]
        updated_fields.append("smtp_port")

    if "smtp_user" in update_data and update_data["smtp_user"] is not None:
        settings.SMTP_USER = update_data["smtp_user"]
        updated_fields.append("smtp_user")

    return SettingsUpdateResponse(
        updated_fields=updated_fields,
        message=f"Updated {len(updated_fields)} setting(s) successfully"
        if updated_fields
        else "No settings were updated",
    )

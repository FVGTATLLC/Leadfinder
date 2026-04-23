import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_role
from app.schemas.message import (
    BulkGenerateRequest,
    BulkGenerateResponse,
    MessageApproveRequest,
    MessageCreate,
    MessageListResponse,
    MessageRegenerateRequest,
    MessageRejectRequest,
    MessageResponse,
    MessageSendResponse,
    MessageUpdate,
)
from app.schemas.user import TokenPayload
from app.services import message_service
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("", response_model=PaginatedResponse[MessageListResponse])
async def list_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    campaign_id: uuid.UUID | None = Query(default=None),
    contact_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await message_service.list_messages(
        db,
        campaign_id=campaign_id,
        contact_id=contact_id,
        status=status,
        search=search,
        pagination=params,
    )
    return result


@router.get("/stats/{campaign_id}")
async def get_message_stats(
    campaign_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    stats = await message_service.get_message_stats(db, campaign_id)
    return stats


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MessageResponse:
    message = await message_service.get_message(db, message_id)
    return MessageResponse.from_message(message)


@router.patch("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: uuid.UUID,
    data: MessageUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MessageResponse:
    message = await message_service.update_message(db, message_id, data)
    return MessageResponse.from_message(message)


@router.delete("/{message_id}", status_code=204)
async def delete_message(
    message_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await message_service.delete_message(db, message_id)


@router.post("/{message_id}/approve", response_model=MessageResponse)
async def approve_message(
    message_id: uuid.UUID,
    body: MessageApproveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        TokenPayload,
        Depends(require_role(["reviewer", "manager", "admin"])),
    ],
) -> MessageResponse:
    message = await message_service.approve_message(
        db, message_id, uuid.UUID(current_user.sub)
    )
    return MessageResponse.from_message(message)


@router.post("/{message_id}/reject", response_model=MessageResponse)
async def reject_message(
    message_id: uuid.UUID,
    body: MessageRejectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MessageResponse:
    message = await message_service.reject_message(
        db, message_id, body.feedback
    )
    return MessageResponse.from_message(message)


@router.post("/{message_id}/regenerate", response_model=MessageResponse)
async def regenerate_message(
    message_id: uuid.UUID,
    body: MessageRegenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MessageResponse:
    message = await message_service.regenerate_message(
        db,
        message_id,
        uuid.UUID(current_user.sub),
        tone=body.tone,
        variant_label=body.variant_label,
        additional_context=body.additional_context,
    )
    return MessageResponse.from_message(message)


@router.post("/{message_id}/send", response_model=MessageSendResponse)
async def send_message(
    message_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[
        TokenPayload,
        Depends(require_role(["sales_rep", "manager", "admin"])),
    ],
) -> MessageSendResponse:
    message = await message_service.send_message(db, message_id)
    return MessageSendResponse(
        message_id=message.id,
        status=message.status,
        sent_at=message.sent_at,
        error=message.error_message,
    )


@router.post("/generate", response_model=BulkGenerateResponse, status_code=202)
async def bulk_generate_messages(
    data: BulkGenerateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> BulkGenerateResponse:
    from app.tasks.message_tasks import generate_campaign_messages_task

    task = generate_campaign_messages_task.delay(
        campaign_id=str(data.campaign_id),
        user_id=current_user.sub,
        step_number=data.step_number,
        tone_override=data.tone_override,
    )

    return BulkGenerateResponse(
        total_contacts=0,
        messages_generated=0,
        messages_failed=0,
        task_id=task.id,
    )

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_role
from app.schemas.team import (
    TeamCreate,
    TeamListResponse,
    TeamMemberAdd,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdate,
)
from app.schemas.user import TokenPayload
from app.services import team_service
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=PaginatedResponse[TeamListResponse])
async def list_teams(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    return await team_service.list_teams(db, pagination=params)


@router.post("", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(require_role(["admin", "manager"]))],
) -> TeamResponse:
    return await team_service.create_team(db, uuid.UUID(current_user.sub), data)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TeamResponse:
    return await team_service.get_team(db, team_id)


@router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    data: TeamUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(require_role(["admin", "manager"]))],
) -> TeamResponse:
    return await team_service.update_team(db, team_id, data)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> None:
    await team_service.delete_team(db, team_id)


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def get_team_members(
    team_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[TeamMemberResponse]:
    return await team_service.get_team_members(db, team_id)


@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=201)
async def add_member(
    team_id: uuid.UUID,
    data: TeamMemberAdd,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(require_role(["admin", "manager"]))],
) -> TeamMemberResponse:
    return await team_service.add_member(db, team_id, data.user_id)


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[TokenPayload, Depends(require_role(["admin", "manager"]))],
) -> None:
    await team_service.remove_member(db, team_id, user_id)

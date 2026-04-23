import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.team import Team
from app.models.user import User
from app.schemas.team import (
    TeamCreate,
    TeamListResponse,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdate,
)
from app.utils.pagination import PaginatedResponse, PaginationParams, paginate


def _team_to_response(team: Team, member_count: int) -> TeamResponse:
    return TeamResponse(
        id=team.id,
        name=team.name,
        description=team.description,
        created_by=team.created_by,
        member_count=member_count,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


async def _count_members(db: AsyncSession, team_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.team_id == team_id,
        User.is_deleted.is_(False),
        User.is_active.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalar_one()


async def create_team(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: TeamCreate,
) -> TeamResponse:
    team = Team(
        name=data.name,
        description=data.description,
        created_by=user_id,
    )
    db.add(team)
    await db.flush()
    await db.refresh(team)
    return _team_to_response(team, member_count=0)


async def get_team(
    db: AsyncSession,
    team_id: uuid.UUID,
) -> TeamResponse:
    stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")
    member_count = await _count_members(db, team_id)
    return _team_to_response(team, member_count)


async def list_teams(
    db: AsyncSession,
    pagination: PaginationParams | None = None,
) -> dict:
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Team)
        .where(Team.is_deleted.is_(False))
        .order_by(Team.created_at.desc())
    )

    result = await paginate(db, query, pagination)

    items = []
    for team in result["items"]:
        member_count = await _count_members(db, team.id)
        items.append(
            TeamListResponse(
                id=team.id,
                name=team.name,
                member_count=member_count,
                created_at=team.created_at,
            )
        )
    result["items"] = items
    return result


async def update_team(
    db: AsyncSession,
    team_id: uuid.UUID,
    data: TeamUpdate,
) -> TeamResponse:
    stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.flush()
    await db.refresh(team)
    member_count = await _count_members(db, team_id)
    return _team_to_response(team, member_count)


async def delete_team(
    db: AsyncSession,
    team_id: uuid.UUID,
) -> None:
    stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")

    team.is_deleted = True
    await db.flush()


async def add_member(
    db: AsyncSession,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
) -> TeamMemberResponse:
    # Verify team exists
    team_stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    team_result = await db.execute(team_stmt)
    team = team_result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")

    # Verify user exists
    user_stmt = select(User).where(
        User.id == user_id,
        User.is_deleted.is_(False),
    )
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    if user.team_id == team_id:
        raise ConflictError(f"User '{user_id}' is already a member of team '{team_id}'")

    user.team_id = team_id
    await db.flush()
    await db.refresh(user)

    return TeamMemberResponse(
        user_id=user.id,
        user_name=user.full_name,
        user_email=user.email,
        role=user.role,
        joined_at=user.updated_at,
    )


async def remove_member(
    db: AsyncSession,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    # Verify team exists
    team_stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    team_result = await db.execute(team_stmt)
    team = team_result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")

    # Verify user exists and is a member
    user_stmt = select(User).where(
        User.id == user_id,
        User.is_deleted.is_(False),
    )
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    if user.team_id != team_id:
        raise NotFoundError(f"User '{user_id}' is not a member of team '{team_id}'")

    user.team_id = None
    await db.flush()


async def get_team_members(
    db: AsyncSession,
    team_id: uuid.UUID,
) -> list[TeamMemberResponse]:
    # Verify team exists
    team_stmt = select(Team).where(
        Team.id == team_id,
        Team.is_deleted.is_(False),
    )
    team_result = await db.execute(team_stmt)
    team = team_result.scalar_one_or_none()
    if team is None:
        raise NotFoundError(f"Team with id '{team_id}' not found")

    stmt = (
        select(User)
        .where(
            User.team_id == team_id,
            User.is_deleted.is_(False),
            User.is_active.is_(True),
        )
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    users = list(result.scalars().all())

    return [
        TeamMemberResponse(
            user_id=u.id,
            user_name=u.full_name,
            user_email=u.email,
            role=u.role,
            joined_at=u.updated_at,
        )
        for u in users
    ]

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import NotFoundError
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.user import TokenPayload, UserCreate, UserResponse, UserUpdate
from app.services.auth_service import create_user, hash_password
from app.utils.pagination import PaginatedResponse, PaginationParams, paginate

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=201)
async def admin_create_user(
    user_data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> UserResponse:
    """Admin creates a new user (immediately active, no approval needed)."""
    user = await create_user(db, user_data, pending_approval=False)
    return UserResponse.model_validate(user)


@router.post("/{user_id}/approve")
async def approve_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
):
    """Approve a pending user registration. Auto-generates a password."""
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    # Generate an 8-char random password
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    user.is_active = True
    await db.flush()
    await db.refresh(user)
    return {"user": UserResponse.model_validate(user).model_dump(mode="json"), "temporary_password": temp_password}


class AdminResetPasswordRequest(BaseModel):
    new_password: str | None = None


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    request: AdminResetPasswordRequest = AdminResetPasswordRequest(),
):
    """Admin resets a user's password.

    If no new_password is provided, auto-generates an 8-char random one.
    Returns the plaintext password so admin can share it with the user.
    User must change it on next login.
    """
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    # Auto-generate 8-char password if not provided
    new_password = request.new_password or ''.join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(8)
    )

    user.password_hash = hash_password(new_password)
    user.must_change_password = True
    await db.flush()
    await db.refresh(user)
    return {
        "user": UserResponse.model_validate(user).model_dump(mode="json"),
        "temporary_password": new_password,
    }


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    query = select(User).where(User.is_deleted.is_(False))

    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        query = query.where(
            (User.full_name.ilike(f"%{search}%"))
            | (User.email.ilike(f"%{search}%"))
        )

    query = query.order_by(User.created_at.desc())
    result = await paginate(db, query, params)
    result["items"] = [UserResponse.model_validate(u) for u in result["items"]]
    return result


@router.get("/admin/active-sessions")
async def get_active_sessions(
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = select(User).where(
        User.is_deleted.is_(False),
        User.is_active.is_(True),
        User.last_active_at > threshold,
    ).order_by(User.last_active_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [{"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role, "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None} for u in users]


@router.get("/admin/dashboard-stats")
async def get_admin_dashboard_stats(
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
):

    total = (await db.execute(select(func.count(User.id)).where(User.is_deleted.is_(False)))).scalar_one()
    active = (await db.execute(select(func.count(User.id)).where(User.is_deleted.is_(False), User.is_active.is_(True)))).scalar_one()
    pending = (await db.execute(select(func.count(User.id)).where(User.is_deleted.is_(False), User.is_active.is_(False)))).scalar_one()

    threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
    online = (await db.execute(select(func.count(User.id)).where(User.is_deleted.is_(False), User.is_active.is_(True), User.last_active_at > threshold))).scalar_one()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_registrations = (await db.execute(select(func.count(User.id)).where(User.is_deleted.is_(False), User.created_at > week_ago))).scalar_one()

    return {"total_users": total, "active_users": active, "pending_approvals": pending, "online_now": online, "recent_registrations": recent_registrations}


@router.get("/admin/global-activity")
async def get_global_activity(
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=30, ge=1, le=100),
):

    offset = (page - 1) * per_page

    # Get total count
    count_stmt = select(func.count(ActivityLog.id))
    total = (await db.execute(count_stmt)).scalar_one()

    # Get activity logs with user info
    stmt = (
        select(ActivityLog, User.email, User.full_name)
        .outerjoin(User, ActivityLog.user_id == User.id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    rows = result.all()

    items = []
    for log, email, full_name in rows:
        items.append({
            "id": str(log.id),
            "user_email": email,
            "user_name": full_name,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id) if log.entity_id else None,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> UserResponse:
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> UserResponse:
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role" and value is not None:
            setattr(user, field, value.value if hasattr(value, "value") else value)
        else:
            setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> UserResponse:
    """Enable or disable a user account."""
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    user.is_active = not user.is_active
    await db.flush()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/{user_id}/reject")
async def reject_user(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
):
    """Reject a pending user registration (soft delete)."""
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("User not found")
    user.is_deleted = True
    await db.flush()
    await db.refresh(user)
    return {"status": "rejected", "message": f"User {user.email} registration rejected."}


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> dict:
    """Get activity logs for a specific user."""
    # Verify user exists
    user_stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    if user is None:
        raise NotFoundError(f"User with id '{user_id}' not found")

    # Get activity logs
    query = (
        select(ActivityLog)
        .where(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
    )
    params = PaginationParams(page=page, per_page=per_page)
    result = await paginate(db, query, params)

    result["items"] = [
        {
            "id": str(log.id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in result["items"]
    ]
    result["user"] = {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
    }
    return result


@router.get("/admin/activity-summary")
async def get_activity_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[TokenPayload, Depends(require_role(["admin"]))],
) -> list[dict]:
    """Get activity summary for all users."""
    stmt = (
        select(
            User.id,
            User.email,
            User.full_name,
            User.is_active,
            User.last_login_at,
            func.count(ActivityLog.id).label("total_actions"),
        )
        .outerjoin(ActivityLog, ActivityLog.user_id == User.id)
        .where(User.is_deleted.is_(False), User.role != "admin")
        .group_by(User.id)
        .order_by(User.full_name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "email": row.email,
            "full_name": row.full_name,
            "is_active": row.is_active,
            "last_login_at": row.last_login_at.isoformat() if row.last_login_at else None,
            "total_actions": row.total_actions,
        }
        for row in rows
    ]

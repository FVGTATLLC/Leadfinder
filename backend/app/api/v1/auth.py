import secrets
import string
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.schemas.user import (
    ChangePasswordRequest,
    LoginResponse,
    TokenPayload,
    TokenResponse,
    UserCreate,
    UserCreateSelfRegister,
    UserLogin,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    change_password,
    create_access_token,
    create_user,
    create_user_self_register,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    user_data: UserCreateSelfRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    # Restrict self-registration to allowed email domain
    from app.exceptions import ValidationError

    email_domain = user_data.email.split("@")[1].lower() if "@" in user_data.email else ""
    allowed_domain = settings.ALLOWED_EMAIL_DOMAIN
    if allowed_domain and not email_domain.endswith(allowed_domain):
        raise ValidationError(
            f"Registration is only allowed with @{allowed_domain} email addresses."
        )

    # Self-registered users start as inactive (pending admin approval)
    # Auto-generate a temporary password (never shared with the user)
    user = await create_user_self_register(
        db,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role.value,
    )
    return UserResponse.model_validate(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    user = await authenticate_user(db, credentials.email, credentials.password)
    token = create_access_token(
        str(user.id),
        user.role,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
        must_change_password=user.must_change_password,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TokenResponse:
    token = create_access_token(
        current_user.sub,
        current_user.role,
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
    )


@router.post("/change-password", response_model=UserResponse)
async def change_user_password(
    request: ChangePasswordRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    user = await change_password(
        db, current_user.sub, request.current_password, request.new_password
    )
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    from sqlalchemy import select

    from app.models.user import User

    stmt = select(User).where(
        User.id == current_user.sub,
        User.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        from app.exceptions import NotFoundError

        raise NotFoundError("User not found")
    return UserResponse.model_validate(user)

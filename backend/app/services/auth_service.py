import secrets
import string
from datetime import datetime, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.models.user import User
from app.schemas.user import TokenPayload, UserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(
    user_id: str,
    role: str,
) -> str:
    expire_minutes = settings.JWT_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    expire = int(now.timestamp()) + (expire_minutes * 60)
    payload: dict = {
        "sub": user_id,
        "role": role,
        "exp": expire,
        "iat": int(now.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        sub = payload.get("sub")
        role = payload.get("role")
        exp = payload.get("exp")
        if sub is None or role is None or exp is None:
            raise UnauthorizedError("Invalid token payload")
        return TokenPayload(
            sub=sub,
            role=role,
            exp=exp,
        )
    except JWTError as e:
        raise UnauthorizedError(f"Invalid or expired token: {e}")


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    stmt = select(User).where(User.email == email, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedError("Invalid email or password")

    if not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    if not user.is_active:
        raise UnauthorizedError("Account is deactivated. Please contact your administrator.")

    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    return user


async def create_user(
    db: AsyncSession, user_data: UserCreate, pending_approval: bool = False
) -> User:
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        raise ConflictError(f"User with email '{user_data.email}' already exists")

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role.value,
        is_active=not pending_approval,  # Inactive until admin approves
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def create_user_self_register(db: AsyncSession, email: str, full_name: str, role: str) -> User:
    """Create a user from self-registration (no password - pending approval)."""
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise ConflictError(f"User with email '{email}' already exists")

    # Generate a random temporary password (user won't use this)
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

    user = User(
        email=email,
        password_hash=hash_password(temp_password),
        full_name=full_name,
        role=role,
        is_active=False,  # Pending approval
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def change_password(
    db: AsyncSession, user_id: str, current_password: str, new_password: str
) -> User:
    stmt = select(User).where(User.id == user_id, User.is_deleted.is_(False))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise NotFoundError("User not found")

    if not verify_password(current_password, user.password_hash):
        raise UnauthorizedError("Current password is incorrect")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await db.flush()
    await db.refresh(user)
    return user

import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.dependencies import get_current_user, get_db
from app.models import Base
from app.schemas.user import TokenPayload
from app.services.auth_service import create_access_token, hash_password

# Use SQLite for tests (in-memory)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database() -> AsyncGenerator[None, None]:
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for tests."""
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def test_user_id() -> str:
    """Return a stable test user UUID string."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_user_id: str) -> dict:
    """Insert a test user into the database and return its data."""
    from app.models.user import User

    user = User(
        id=test_user_id,
        email="test@salespilot.com",
        password_hash=hash_password("TestPassword123"),
        full_name="Test User",
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
    }


@pytest_asyncio.fixture
async def auth_headers(test_user: dict) -> dict[str, str]:
    """Return Authorization headers with a valid JWT for the test user."""
    token = create_access_token(test_user["id"], test_user["role"])
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, test_user: dict) -> AsyncGenerator[AsyncClient, None]:
    """Provide an async HTTP test client with dependency overrides."""
    from app.main import create_app

    app = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

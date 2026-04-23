"""Seed an initial admin user. Run after migrations.

Usage:
    DATABASE_URL=postgresql+asyncpg://... python -m scripts.seed_admin
"""
import asyncio
import os
import sys
from uuid import uuid4

# Allow running from backend/ directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def seed() -> None:
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, text

    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/salespilot",
    )
    engine = create_async_engine(db_url)

    async with engine.begin() as conn:
        # Check if admin already exists
        result = await conn.execute(
            text("SELECT id FROM users WHERE email = 'admin@clubconcierge.com'")
        )
        if result.fetchone():
            print("Admin user already exists, skipping seed.")
            await engine.dispose()
            return

        # Hash the password using passlib
        from passlib.hash import bcrypt
        password_hash = bcrypt.hash("admin123")

        team_id = str(uuid4())
        admin_id = str(uuid4())

        # Create default team
        await conn.execute(
            text(
                "INSERT INTO teams (id, name, description, created_by) "
                "VALUES (:id, :name, :desc, :created_by)"
            ),
            {"id": team_id, "name": "Default Team", "desc": "Initial team", "created_by": admin_id},
        )

        # Create admin user
        await conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, full_name, role, team_id, is_active) "
                "VALUES (:id, :email, :pw, :name, :role, :team_id, true)"
            ),
            {
                "id": admin_id,
                "email": "admin@clubconcierge.com",
                "pw": password_hash,
                "name": "Admin User",
                "role": "admin",
                "team_id": team_id,
            },
        )

    await engine.dispose()
    print("Admin user created: admin@clubconcierge.com / admin123")
    print("IMPORTANT: Change this password immediately after first login!")


if __name__ == "__main__":
    asyncio.run(seed())

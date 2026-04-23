"""Add sender signature fields to users table.

Revision ID: 004
Revises: 003
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sender_title", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("sender_phone", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "sender_phone")
    op.drop_column("users", "sender_title")

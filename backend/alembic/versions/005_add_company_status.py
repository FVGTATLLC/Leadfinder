"""Add status column to companies table.

Revision ID: 005
Revises: 004
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="new",
        ),
    )


def downgrade() -> None:
    op.drop_column("companies", "status")

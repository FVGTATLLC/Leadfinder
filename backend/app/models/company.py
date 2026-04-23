import uuid

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Company(Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    domain: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
    )
    industry: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    sub_industry: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    geography: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    country: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    employee_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    revenue_range: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    travel_intensity: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    icp_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    score_breakdown: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    company_size: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    source: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    linkedin_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    website: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    creator: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ResearchBrief(Base):
    __tablename__ = "research_briefs"

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id"),
        nullable=True,
        index=True,
    )
    brief_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    content: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )
    sources: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    generated_by: Mapped[str] = mapped_column(
        String(50),
        default="research_agent",
        server_default="research_agent",
        nullable=False,
    )
    llm_model_used: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    company: Mapped["Company | None"] = relationship(  # noqa: F821
        "Company",
        foreign_keys=[company_id],
        lazy="selectin",
    )
    contact: Mapped["Contact | None"] = relationship(  # noqa: F821
        "Contact",
        foreign_keys=[contact_id],
        lazy="selectin",
    )

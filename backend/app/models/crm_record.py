import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CRMRecord(Base):
    __tablename__ = "crm_records"

    __table_args__ = (
        Index("ix_crm_records_type_status", "record_type", "export_status"),
    )

    record_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
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
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=True,
        index=True,
    )
    data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )
    export_status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        server_default="pending",
        nullable=False,
    )
    exported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    export_format: Mapped[str] = mapped_column(
        String(20),
        default="csv",
        server_default="csv",
        nullable=False,
    )
    file_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
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
    campaign: Mapped["Campaign | None"] = relationship(  # noqa: F821
        "Campaign",
        foreign_keys=[campaign_id],
        lazy="selectin",
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MessageDraft(Base):
    __tablename__ = "message_drafts"

    __table_args__ = (
        Index("ix_message_drafts_campaign_status", "campaign_id", "status"),
        Index("ix_message_drafts_contact_status", "contact_id", "status"),
    )

    sequence_step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sequence_steps.id"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id"),
        nullable=False,
        index=True,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    tone: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    variant_label: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    context_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="draft",
        server_default="draft",
        nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    replied_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    sequence_step: Mapped["SequenceStep | None"] = relationship(  # noqa: F821
        "SequenceStep",
        foreign_keys=[sequence_step_id],
        lazy="selectin",
    )
    contact: Mapped["Contact"] = relationship(  # noqa: F821
        "Contact",
        foreign_keys=[contact_id],
        lazy="selectin",
    )
    campaign: Mapped["Campaign"] = relationship(  # noqa: F821
        "Campaign",
        foreign_keys=[campaign_id],
        lazy="selectin",
    )
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )
    approver: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[approved_by],
        lazy="selectin",
    )

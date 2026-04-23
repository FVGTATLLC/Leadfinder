import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    strategy_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("strategies.id"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    campaign_type: Mapped[str] = mapped_column(
        String(50),
        default="intro",
        server_default="intro",
        nullable=False,
    )
    tone_preset: Mapped[str] = mapped_column(
        String(50),
        default="consultative",
        server_default="consultative",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="draft",
        server_default="draft",
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
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
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    strategy: Mapped["Strategy | None"] = relationship(  # noqa: F821
        "Strategy",
        foreign_keys=[strategy_id],
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
    steps: Mapped[list["SequenceStep"]] = relationship(  # noqa: F821
        "SequenceStep",
        back_populates="campaign",
        lazy="selectin",
        order_by="SequenceStep.step_number",
    )
    contacts: Mapped[list["CampaignContact"]] = relationship(
        "CampaignContact",
        back_populates="campaign",
        lazy="selectin",
    )


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    __table_args__ = (
        UniqueConstraint("campaign_id", "contact_id", name="uq_campaign_contact"),
    )

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        server_default="active",
        nullable=False,
    )
    current_step: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign: Mapped["Campaign"] = relationship(
        "Campaign",
        back_populates="contacts",
        lazy="selectin",
    )
    contact: Mapped["Contact"] = relationship(  # noqa: F821
        "Contact",
        lazy="selectin",
    )

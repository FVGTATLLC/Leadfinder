import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SequenceStep(Base):
    __tablename__ = "sequence_steps"

    __table_args__ = (
        UniqueConstraint("campaign_id", "step_number", name="uq_campaign_step_number"),
    )

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id"),
        nullable=False,
        index=True,
    )
    step_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    delay_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    step_type: Mapped[str] = mapped_column(
        String(50),
        default="email",
        server_default="email",
        nullable=False,
    )
    subject_template: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    body_template: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    campaign: Mapped["Campaign"] = relationship(  # noqa: F821
        "Campaign",
        back_populates="steps",
        lazy="selectin",
    )

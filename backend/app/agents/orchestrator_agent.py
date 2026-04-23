import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignContact
from app.models.contact import Contact
from app.models.message_draft import MessageDraft
from app.models.research_brief import ResearchBrief
from app.models.sequence_step import SequenceStep

logger = logging.getLogger(__name__)


@dataclass
class OrchestratorResult:
    campaigns_processed: int = 0
    contacts_advanced: int = 0
    messages_generated: int = 0
    messages_sent: int = 0
    campaigns_completed: int = 0
    errors: list[str] = field(default_factory=list)


class OrchestratorAgent:
    """
    Logic-based orchestrator that coordinates the campaign follow-up pipeline.

    This is NOT an LLM agent — it is a state-machine manager that queries active
    campaigns, determines which contacts are ready for their next sequence step,
    triggers research and message generation via the appropriate agents, and
    handles sending of approved messages.
    """

    def __init__(
        self,
        db_session: AsyncSession,
        messaging_agent: "MessagingAgent | None" = None,  # noqa: F821
        research_agent: "ResearchAgent | None" = None,  # noqa: F821
        email_sender: "EmailSender | None" = None,  # noqa: F821
    ) -> None:
        self.db = db_session
        self.messaging_agent = messaging_agent
        self.research_agent = research_agent
        self.email_sender = email_sender

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def tick(self) -> OrchestratorResult:
        """
        Main orchestration loop called periodically by Celery beat.

        1. Process each active campaign (advance contacts, generate messages).
        2. Send all approved messages that are due.
        3. Mark finished campaigns as completed.
        """
        result = OrchestratorResult()

        try:
            # 1. Process active campaigns
            active_campaigns = await self._get_active_campaigns()
            for campaign in active_campaigns:
                try:
                    campaign_result = await self.process_campaign(campaign)
                    result.campaigns_processed += 1
                    result.contacts_advanced += campaign_result.get("contacts_advanced", 0)
                    result.messages_generated += campaign_result.get("messages_generated", 0)
                except Exception as exc:
                    error_msg = f"Error processing campaign {campaign.id}: {exc}"
                    logger.error(error_msg)
                    result.errors.append(error_msg)

            # 2. Send approved messages
            try:
                sent_count = await self.send_approved_messages()
                result.messages_sent = sent_count
            except Exception as exc:
                error_msg = f"Error sending approved messages: {exc}"
                logger.error(error_msg)
                result.errors.append(error_msg)

            # 3. Complete finished campaigns
            try:
                completed_count = await self.complete_finished_campaigns()
                result.campaigns_completed = completed_count
            except Exception as exc:
                error_msg = f"Error completing campaigns: {exc}"
                logger.error(error_msg)
                result.errors.append(error_msg)

        except Exception as exc:
            error_msg = f"Orchestrator tick failed: {exc}"
            logger.error(error_msg)
            result.errors.append(error_msg)

        logger.info(
            "Orchestrator tick complete: campaigns=%d, contacts_advanced=%d, "
            "messages_generated=%d, messages_sent=%d, campaigns_completed=%d, errors=%d",
            result.campaigns_processed,
            result.contacts_advanced,
            result.messages_generated,
            result.messages_sent,
            result.campaigns_completed,
            len(result.errors),
        )

        return result

    # ------------------------------------------------------------------
    # Campaign processing
    # ------------------------------------------------------------------

    async def process_campaign(self, campaign: Campaign) -> dict:
        """Process a single active campaign: advance contacts through sequence steps."""
        summary = {"contacts_advanced": 0, "messages_generated": 0}

        # Get sequence steps ordered by step_number
        steps_stmt = (
            select(SequenceStep)
            .where(
                SequenceStep.campaign_id == campaign.id,
                SequenceStep.is_deleted.is_(False),
            )
            .order_by(SequenceStep.step_number)
        )
        steps_result = await self.db.execute(steps_stmt)
        steps = list(steps_result.scalars().all())

        if not steps:
            logger.debug("Campaign %s has no sequence steps, skipping", campaign.id)
            return summary

        # Build a lookup: step_number -> SequenceStep
        step_map: dict[int, SequenceStep] = {s.step_number: s for s in steps}
        max_step_number = max(step_map.keys())

        # Get active campaign contacts
        cc_stmt = select(CampaignContact).where(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.status == "active",
        )
        cc_result = await self.db.execute(cc_stmt)
        campaign_contacts = list(cc_result.scalars().all())

        if not campaign_contacts:
            logger.debug("Campaign %s has no active contacts, skipping", campaign.id)
            return summary

        for cc in campaign_contacts:
            try:
                current_step_num = cc.current_step
                next_step_num = current_step_num + 1

                # Contact has completed all steps
                if next_step_num > max_step_number:
                    cc.status = "completed"
                    await self.db.flush()
                    continue

                next_step = step_map.get(next_step_num)
                if next_step is None:
                    # Step number gap — find the next available step
                    available = sorted(n for n in step_map if n > current_step_num)
                    if not available:
                        cc.status = "completed"
                        await self.db.flush()
                        continue
                    next_step_num = available[0]
                    next_step = step_map[next_step_num]

                # Check delay: has enough time passed since last sent message?
                ready = await self._is_contact_ready(
                    campaign.id, cc.contact_id, next_step.delay_days
                )
                if not ready:
                    continue

                # Load the contact record
                contact = await self._get_contact(cc.contact_id)
                if contact is None:
                    continue

                # Process this contact's next step
                step_result = await self.process_contact_step(
                    campaign, cc, next_step, contact
                )

                if step_result.get("message_generated"):
                    summary["messages_generated"] += 1

                # Advance the contact's current_step pointer
                cc.current_step = next_step_num
                await self.db.flush()
                summary["contacts_advanced"] += 1

            except Exception as exc:
                logger.error(
                    "Error processing contact %s in campaign %s: %s",
                    cc.contact_id,
                    campaign.id,
                    exc,
                )

        # Check for replied contacts
        try:
            await self.check_for_replies(campaign.id)
        except Exception as exc:
            logger.error("Error checking replies for campaign %s: %s", campaign.id, exc)

        return summary

    async def process_contact_step(
        self,
        campaign: Campaign,
        campaign_contact: CampaignContact,
        next_step: SequenceStep,
        contact: Contact,
    ) -> dict:
        """
        Process a single contact's next sequence step:
        1. Ensure a research brief exists.
        2. Generate a message draft via the messaging agent.
        3. Set status based on campaign approval setting.
        """
        result = {"message_generated": False}

        # 1. Ensure research brief exists
        research_data = await self._get_or_generate_research(contact)

        # 2. Build input for messaging agent
        contact_name_parts = []
        if contact.first_name:
            contact_name_parts.append(contact.first_name)
        if contact.last_name:
            contact_name_parts.append(contact.last_name)
        contact_name = " ".join(contact_name_parts) if contact_name_parts else ""

        contact_data = {
            "name": contact_name,
            "title": contact.job_title or "",
            "email": contact.email or "",
            "persona_type": contact.persona_type or "",
        }

        company_data = {}
        if contact.company:
            company_data = {
                "name": contact.company.name or "",
                "industry": contact.company.industry or "",
                "geography": contact.company.geography or "",
                "size": contact.company.employee_count,
            }

        # Gather previous messages for follow-up context
        previous_messages = await self._get_previous_messages(
            campaign.id, contact.id
        )

        if self.messaging_agent is None:
            logger.warning("No messaging agent configured, skipping message generation")
            return result

        try:
            agent_result = await self.messaging_agent.execute({
                "contact": contact_data,
                "company": company_data,
                "research_brief": research_data,
                "campaign_type": campaign.campaign_type or "intro",
                "tone_preset": campaign.tone_preset or "consultative",
                "step_number": next_step.step_number,
                "previous_messages": previous_messages,
                "additional_context": None,
            })

            if not agent_result.success:
                logger.error(
                    "Messaging agent failed for contact %s: %s",
                    contact.id,
                    agent_result.error,
                )
                return result

            generated = agent_result.data

            # Determine message status based on campaign approval setting
            # If campaign has been approved by a manager, auto-approve messages
            if campaign.approved_by is not None:
                message_status = "approved"
            else:
                message_status = "pending_approval"

            message = MessageDraft(
                sequence_step_id=next_step.id,
                contact_id=contact.id,
                campaign_id=campaign.id,
                subject=generated.get("subject", ""),
                body=generated.get("body", ""),
                tone=campaign.tone_preset or "consultative",
                variant_label=generated.get("variant_label"),
                context_data={
                    "company_data": company_data,
                    "research_used": research_data is not None,
                    "auto_generated": True,
                    "step_number": next_step.step_number,
                },
                status=message_status,
                created_by=campaign.created_by,
            )
            self.db.add(message)
            await self.db.flush()

            result["message_generated"] = True
            result["message_id"] = str(message.id)
            result["message_status"] = message_status

        except Exception as exc:
            logger.error(
                "Failed to generate message for contact %s step %d: %s",
                contact.id,
                next_step.step_number,
                exc,
            )

        return result

    # ------------------------------------------------------------------
    # Reply detection
    # ------------------------------------------------------------------

    async def check_for_replies(self, campaign_id: uuid.UUID) -> int:
        """
        Check message_drafts with status='replied' and update corresponding
        campaign_contacts to status='replied'.
        Returns count of contacts updated.
        """
        # Find messages that have been marked as replied
        stmt = select(MessageDraft).where(
            MessageDraft.campaign_id == campaign_id,
            MessageDraft.status == "replied",
            MessageDraft.is_deleted.is_(False),
        )
        msg_result = await self.db.execute(stmt)
        replied_messages = list(msg_result.scalars().all())

        if not replied_messages:
            return 0

        replied_contact_ids = {m.contact_id for m in replied_messages}
        updated = 0

        for contact_id in replied_contact_ids:
            cc_stmt = select(CampaignContact).where(
                CampaignContact.campaign_id == campaign_id,
                CampaignContact.contact_id == contact_id,
                CampaignContact.status == "active",
            )
            cc_result = await self.db.execute(cc_stmt)
            cc = cc_result.scalar_one_or_none()
            if cc:
                cc.status = "replied"
                await self.db.flush()
                updated += 1

        return updated

    # ------------------------------------------------------------------
    # Message sending
    # ------------------------------------------------------------------

    async def send_approved_messages(self) -> int:
        """
        Query messages with status='approved' and (scheduled_for <= now OR no scheduled_for).
        Send each via the email sender. Update status to 'sent' or 'failed'.
        Returns count of messages successfully sent.
        """
        now = datetime.now(timezone.utc)

        stmt = select(MessageDraft).where(
            MessageDraft.status == "approved",
            MessageDraft.is_deleted.is_(False),
        ).where(
            # Either no scheduled time, or scheduled time has passed
            (MessageDraft.scheduled_for.is_(None)) | (MessageDraft.scheduled_for <= now)
        )
        msg_result = await self.db.execute(stmt)
        messages = list(msg_result.scalars().all())

        if not messages:
            return 0

        if self.email_sender is None:
            from app.utils.email_sender import get_email_sender
            self.email_sender = get_email_sender()

        sent_count = 0

        for message in messages:
            contact = message.contact
            if not contact or not contact.email:
                message.status = "failed"
                message.error_message = "Contact has no email address"
                await self.db.flush()
                continue

            try:
                send_result = await self.email_sender.send_email(
                    to_email=contact.email,
                    subject=message.subject or "",
                    body=message.body,
                    from_email=self.email_sender.username,
                    from_name="SalesPilot",
                )

                if send_result["success"]:
                    message.status = "sent"
                    message.sent_at = now
                    message.error_message = None
                    sent_count += 1
                else:
                    message.status = "failed"
                    message.error_message = send_result.get("error", "Unknown send error")

            except Exception as exc:
                message.status = "failed"
                message.error_message = str(exc)
                logger.error(
                    "Failed to send message %s to %s: %s",
                    message.id,
                    contact.email,
                    exc,
                )

            await self.db.flush()

        return sent_count

    # ------------------------------------------------------------------
    # Campaign completion
    # ------------------------------------------------------------------

    async def complete_finished_campaigns(self) -> int:
        """
        Find active campaigns where ALL contacts have completed all steps
        (status in completed, replied, stopped, bounced — i.e., no 'active' contacts remain).
        Set those campaigns to 'completed'. Returns count.
        """
        active_campaigns = await self._get_active_campaigns()
        completed_count = 0

        for campaign in active_campaigns:
            # Check if any contacts are still active
            active_cc_stmt = select(CampaignContact).where(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.status == "active",
            )
            active_result = await self.db.execute(active_cc_stmt)
            active_contacts = list(active_result.scalars().all())

            if len(active_contacts) == 0:
                # Also verify the campaign actually has contacts
                all_cc_stmt = select(CampaignContact).where(
                    CampaignContact.campaign_id == campaign.id,
                )
                all_result = await self.db.execute(all_cc_stmt)
                all_contacts = list(all_result.scalars().all())

                if len(all_contacts) > 0:
                    campaign.status = "completed"
                    campaign.ends_at = datetime.now(timezone.utc)
                    await self.db.flush()
                    completed_count += 1
                    logger.info("Campaign %s marked as completed", campaign.id)

        return completed_count

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _get_active_campaigns(self) -> list[Campaign]:
        """Return all active, non-deleted campaigns."""
        stmt = select(Campaign).where(
            Campaign.status == "active",
            Campaign.is_deleted.is_(False),
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _get_contact(self, contact_id: uuid.UUID) -> Contact | None:
        """Load a contact by ID."""
        stmt = select(Contact).where(
            Contact.id == contact_id,
            Contact.is_deleted.is_(False),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _is_contact_ready(
        self,
        campaign_id: uuid.UUID,
        contact_id: uuid.UUID,
        delay_days: int,
    ) -> bool:
        """
        Check if enough days have elapsed since the last sent message
        for this contact in this campaign.
        """
        last_msg = await self._get_last_sent_message(campaign_id, contact_id)

        if last_msg is None:
            # No message sent yet — contact is ready for step 1 (day 0)
            return True

        if last_msg.sent_at is None:
            return True

        sent_at = last_msg.sent_at
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)

        threshold = sent_at + timedelta(days=delay_days)
        return datetime.now(timezone.utc) >= threshold

    async def _get_last_sent_message(
        self,
        campaign_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> MessageDraft | None:
        """Get the most recently sent message for a contact in a campaign."""
        stmt = (
            select(MessageDraft)
            .where(
                MessageDraft.campaign_id == campaign_id,
                MessageDraft.contact_id == contact_id,
                MessageDraft.status == "sent",
                MessageDraft.is_deleted.is_(False),
            )
            .order_by(MessageDraft.sent_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_or_generate_research(self, contact: Contact) -> dict | None:
        """
        Get existing research brief for the contact (or company fallback).
        If the research agent is available and no brief exists, generate one.
        """
        # Try contact-level brief
        stmt = (
            select(ResearchBrief)
            .where(
                ResearchBrief.is_deleted.is_(False),
                ResearchBrief.contact_id == contact.id,
            )
            .order_by(ResearchBrief.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        brief = result.scalar_one_or_none()

        # Fallback to company-level
        if brief is None and contact.company_id:
            stmt = (
                select(ResearchBrief)
                .where(
                    ResearchBrief.is_deleted.is_(False),
                    ResearchBrief.company_id == contact.company_id,
                    ResearchBrief.contact_id.is_(None),
                )
                .order_by(ResearchBrief.created_at.desc())
                .limit(1)
            )
            result = await self.db.execute(stmt)
            brief = result.scalar_one_or_none()

        # If still no brief and we have a research agent, generate one
        if brief is None and self.research_agent is not None:
            try:
                company_data = {}
                if contact.company:
                    company_data = {
                        "name": contact.company.name or "",
                        "industry": contact.company.industry or "",
                        "geography": contact.company.geography or "",
                    }

                contact_data = {
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "job_title": contact.job_title,
                    "persona_type": contact.persona_type,
                    "linkedin_url": contact.linkedin_url,
                    "email": contact.email,
                }

                agent_result = await self.research_agent.execute({
                    "company_data": company_data,
                    "contact_data": contact_data,
                    "brief_type": "prospect_summary",
                })

                if agent_result.success:
                    content = agent_result.data.get("content", {})
                    new_brief = ResearchBrief(
                        company_id=contact.company_id,
                        contact_id=contact.id,
                        brief_type="prospect_summary",
                        content=content,
                        generated_by="orchestrator_agent",
                        llm_model_used=agent_result.model_used,
                        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                    )
                    self.db.add(new_brief)
                    await self.db.flush()
                    brief = new_brief
            except Exception as exc:
                logger.warning(
                    "Failed to generate research for contact %s: %s",
                    contact.id,
                    exc,
                )

        if brief and brief.content:
            return {
                "summary": brief.content.get("summary", ""),
                "talking_points": brief.content.get("talking_points", []),
                "pain_points": brief.content.get("pain_points", []),
            }

        return None

    async def _get_previous_messages(
        self,
        campaign_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> list[dict]:
        """Get previously sent messages for follow-up context."""
        stmt = (
            select(MessageDraft)
            .where(
                MessageDraft.campaign_id == campaign_id,
                MessageDraft.contact_id == contact_id,
                MessageDraft.status.in_(["sent", "replied"]),
                MessageDraft.is_deleted.is_(False),
            )
            .order_by(MessageDraft.sent_at.asc())
        )
        result = await self.db.execute(stmt)
        messages = list(result.scalars().all())

        return [
            {
                "subject": m.subject or "",
                "body": m.body,
                "sent_at": m.sent_at.isoformat() if m.sent_at else "",
                "step_number": (
                    m.sequence_step.step_number if m.sequence_step else None
                ),
            }
            for m in messages
        ]

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run an async coroutine in a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ------------------------------------------------------------------
# Async implementations
# ------------------------------------------------------------------


async def _tick_orchestrator_impl() -> dict:
    """Async implementation: run one orchestration tick."""
    from app.agents.llm.router import LLMRouter
    from app.agents.messaging_agent import MessagingAgent
    from app.agents.orchestrator_agent import OrchestratorAgent
    from app.utils.database import get_session_factory
    from app.utils.email_sender import get_email_sender

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            llm_router = LLMRouter()
            messaging_agent = MessagingAgent(llm_router=llm_router, db_session=session)
            email_sender = get_email_sender()

            # Optionally create research agent if available
            research_agent = None
            try:
                from app.agents.research_agent import ResearchAgent
                research_agent = ResearchAgent(llm_router=llm_router, db_session=session)
            except Exception:
                logger.debug("Research agent not available, continuing without it")

            orchestrator = OrchestratorAgent(
                db_session=session,
                messaging_agent=messaging_agent,
                research_agent=research_agent,
                email_sender=email_sender,
            )

            result = await orchestrator.tick()
            await session.commit()

            return {
                "status": "completed",
                "campaigns_processed": result.campaigns_processed,
                "contacts_advanced": result.contacts_advanced,
                "messages_generated": result.messages_generated,
                "messages_sent": result.messages_sent,
                "campaigns_completed": result.campaigns_completed,
                "errors": result.errors,
            }

        except Exception as e:
            await session.rollback()
            logger.error("Orchestrator tick failed: %s", str(e))
            return {
                "status": "failed",
                "error": str(e),
            }


async def _send_approved_messages_impl() -> dict:
    """Async implementation: send all approved messages that are due."""
    from app.agents.orchestrator_agent import OrchestratorAgent
    from app.utils.database import get_session_factory
    from app.utils.email_sender import get_email_sender

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            email_sender = get_email_sender()
            orchestrator = OrchestratorAgent(
                db_session=session,
                email_sender=email_sender,
            )

            sent_count = await orchestrator.send_approved_messages()
            await session.commit()

            return {
                "status": "completed",
                "messages_sent": sent_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error("Send approved messages failed: %s", str(e))
            return {
                "status": "failed",
                "error": str(e),
            }


async def _activate_campaign_impl(campaign_id_str: str, user_id_str: str) -> dict:
    """Async implementation: activate a campaign and generate step-1 messages."""
    from sqlalchemy import select

    from app.agents.llm.router import LLMRouter
    from app.agents.messaging_agent import MessagingAgent
    from app.agents.orchestrator_agent import OrchestratorAgent
    from app.models.campaign import Campaign, CampaignContact
    from app.models.sequence_step import SequenceStep
    from app.services import campaign_service
    from app.utils.database import get_session_factory

    campaign_uuid = uuid.UUID(campaign_id_str)
    user_uuid = uuid.UUID(user_id_str)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            # Activate via service (validates contacts + steps exist)
            campaign = await campaign_service.activate_campaign(
                session, campaign_uuid, user_uuid
            )

            # Get step 1 (the first step, typically delay_days=0)
            step_stmt = (
                select(SequenceStep)
                .where(
                    SequenceStep.campaign_id == campaign_uuid,
                    SequenceStep.is_deleted.is_(False),
                )
                .order_by(SequenceStep.step_number)
                .limit(1)
            )
            step_result = await session.execute(step_stmt)
            first_step = step_result.scalar_one_or_none()

            messages_generated = 0

            if first_step and first_step.delay_days == 0:
                # Generate messages for all contacts at step 1 immediately
                llm_router = LLMRouter()
                messaging_agent = MessagingAgent(llm_router=llm_router, db_session=session)

                # Optionally create research agent
                research_agent = None
                try:
                    from app.agents.research_agent import ResearchAgent
                    research_agent = ResearchAgent(llm_router=llm_router, db_session=session)
                except Exception:
                    pass

                orchestrator = OrchestratorAgent(
                    db_session=session,
                    messaging_agent=messaging_agent,
                    research_agent=research_agent,
                )

                # Get all active campaign contacts
                cc_stmt = select(CampaignContact).where(
                    CampaignContact.campaign_id == campaign_uuid,
                    CampaignContact.status == "active",
                )
                cc_result = await session.execute(cc_stmt)
                campaign_contacts = list(cc_result.scalars().all())

                for cc in campaign_contacts:
                    try:
                        contact = await orchestrator._get_contact(cc.contact_id)
                        if contact is None:
                            continue

                        step_result_data = await orchestrator.process_contact_step(
                            campaign, cc, first_step, contact
                        )

                        if step_result_data.get("message_generated"):
                            messages_generated += 1
                            cc.current_step = first_step.step_number

                    except Exception as exc:
                        logger.error(
                            "Failed to generate step-1 message for contact %s: %s",
                            cc.contact_id,
                            exc,
                        )

                await session.flush()

            await session.commit()

            return {
                "status": "activated",
                "campaign_id": campaign_id_str,
                "campaign_status": campaign.status,
                "messages_generated": messages_generated,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to activate campaign %s: %s", campaign_id_str, str(e)
            )
            return {
                "status": "failed",
                "campaign_id": campaign_id_str,
                "error": str(e),
            }


async def _pause_campaign_impl(campaign_id_str: str) -> dict:
    """Async implementation: pause a campaign and cancel pending messages."""
    from sqlalchemy import select, update

    from app.models.message_draft import MessageDraft
    from app.services import campaign_service
    from app.utils.database import get_session_factory

    campaign_uuid = uuid.UUID(campaign_id_str)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            campaign = await campaign_service.pause_campaign(session, campaign_uuid)

            # Cancel pending/draft messages for this campaign
            cancel_stmt = (
                update(MessageDraft)
                .where(
                    MessageDraft.campaign_id == campaign_uuid,
                    MessageDraft.status.in_(["draft", "pending_approval"]),
                    MessageDraft.is_deleted.is_(False),
                )
                .values(
                    status="draft",
                    error_message="Campaign paused",
                )
            )
            result = await session.execute(cancel_stmt)
            cancelled_count = result.rowcount

            await session.commit()

            return {
                "status": "paused",
                "campaign_id": campaign_id_str,
                "messages_cancelled": cancelled_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to pause campaign %s: %s", campaign_id_str, str(e)
            )
            return {
                "status": "failed",
                "campaign_id": campaign_id_str,
                "error": str(e),
            }


async def _resume_campaign_impl(campaign_id_str: str) -> dict:
    """Async implementation: resume a paused campaign."""
    from sqlalchemy import select, update

    from app.models.message_draft import MessageDraft
    from app.services import campaign_service
    from app.utils.database import get_session_factory

    campaign_uuid = uuid.UUID(campaign_id_str)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            # get campaign to validate it exists and check current status
            campaign = await campaign_service.get_campaign(session, campaign_uuid)

            if campaign.status != "paused":
                return {
                    "status": "failed",
                    "campaign_id": campaign_id_str,
                    "error": f"Cannot resume campaign with status '{campaign.status}'",
                }

            campaign.status = "active"
            await session.flush()

            # Re-queue paused draft messages back to pending_approval
            requeue_stmt = (
                update(MessageDraft)
                .where(
                    MessageDraft.campaign_id == campaign_uuid,
                    MessageDraft.status == "draft",
                    MessageDraft.is_deleted.is_(False),
                    MessageDraft.error_message == "Campaign paused",
                )
                .values(
                    status="pending_approval",
                    error_message=None,
                )
            )
            result = await session.execute(requeue_stmt)
            requeued_count = result.rowcount

            await session.commit()

            return {
                "status": "resumed",
                "campaign_id": campaign_id_str,
                "messages_requeued": requeued_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to resume campaign %s: %s", campaign_id_str, str(e)
            )
            return {
                "status": "failed",
                "campaign_id": campaign_id_str,
                "error": str(e),
            }


async def _stop_contact_sequence_impl(
    campaign_id_str: str, contact_id_str: str
) -> dict:
    """Async implementation: stop sequence for a specific contact."""
    from sqlalchemy import select, update

    from app.models.campaign import CampaignContact
    from app.models.message_draft import MessageDraft
    from app.utils.database import get_session_factory

    campaign_uuid = uuid.UUID(campaign_id_str)
    contact_uuid = uuid.UUID(contact_id_str)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            # Update campaign contact status
            cc_stmt = select(CampaignContact).where(
                CampaignContact.campaign_id == campaign_uuid,
                CampaignContact.contact_id == contact_uuid,
            )
            cc_result = await session.execute(cc_stmt)
            cc = cc_result.scalar_one_or_none()

            if cc is None:
                return {
                    "status": "failed",
                    "error": f"Contact {contact_id_str} not found in campaign {campaign_id_str}",
                }

            cc.status = "stopped"
            await session.flush()

            # Cancel pending messages for this contact in this campaign
            cancel_stmt = (
                update(MessageDraft)
                .where(
                    MessageDraft.campaign_id == campaign_uuid,
                    MessageDraft.contact_id == contact_uuid,
                    MessageDraft.status.in_(["draft", "pending_approval", "approved"]),
                    MessageDraft.is_deleted.is_(False),
                )
                .values(
                    status="draft",
                    error_message="Contact sequence stopped",
                )
            )
            result = await session.execute(cancel_stmt)
            cancelled_count = result.rowcount

            await session.commit()

            return {
                "status": "stopped",
                "campaign_id": campaign_id_str,
                "contact_id": contact_id_str,
                "messages_cancelled": cancelled_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to stop contact %s in campaign %s: %s",
                contact_id_str,
                campaign_id_str,
                str(e),
            )
            return {
                "status": "failed",
                "error": str(e),
            }


# ------------------------------------------------------------------
# Celery tasks
# ------------------------------------------------------------------


@celery_app.task(name="app.tasks.campaign_tasks.tick_orchestrator")
def tick_orchestrator() -> dict:
    """Celery beat task: run orchestrator tick every 15 minutes."""
    logger.info("Running orchestrator tick at %s", datetime.now(timezone.utc).isoformat())
    return _run_async(_tick_orchestrator_impl())


@celery_app.task(name="app.tasks.campaign_tasks.send_approved_messages")
def send_approved_messages() -> dict:
    """Celery beat task: send approved messages every 5 minutes."""
    logger.info("Sending approved messages at %s", datetime.now(timezone.utc).isoformat())
    return _run_async(_send_approved_messages_impl())


@celery_app.task(name="app.tasks.campaign_tasks.activate_campaign_task")
def activate_campaign_task(campaign_id: str, user_id: str) -> dict:
    """Celery task: activate a campaign and generate step-1 messages."""
    logger.info("Activating campaign %s by user %s", campaign_id, user_id)
    return _run_async(_activate_campaign_impl(campaign_id, user_id))


@celery_app.task(name="app.tasks.campaign_tasks.pause_campaign_task")
def pause_campaign_task(campaign_id: str) -> dict:
    """Celery task: pause a campaign."""
    logger.info("Pausing campaign %s", campaign_id)
    return _run_async(_pause_campaign_impl(campaign_id))


@celery_app.task(name="app.tasks.campaign_tasks.resume_campaign_task")
def resume_campaign_task(campaign_id: str) -> dict:
    """Celery task: resume a paused campaign."""
    logger.info("Resuming campaign %s", campaign_id)
    return _run_async(_resume_campaign_impl(campaign_id))


@celery_app.task(name="app.tasks.campaign_tasks.stop_contact_sequence")
def stop_contact_sequence(campaign_id: str, contact_id: str) -> dict:
    """Celery task: stop a contact's sequence in a campaign."""
    logger.info("Stopping contact %s in campaign %s", contact_id, campaign_id)
    return _run_async(_stop_contact_sequence_impl(campaign_id, contact_id))

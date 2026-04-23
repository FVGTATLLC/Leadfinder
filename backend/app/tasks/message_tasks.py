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


async def _generate_campaign_messages_impl(
    campaign_id_str: str,
    user_id_str: str,
    step_number: int | None,
    tone_override: str | None,
) -> dict:
    """Async implementation for campaign message generation."""
    from app.services import message_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            campaign_uuid = uuid.UUID(campaign_id_str)
            user_uuid = uuid.UUID(user_id_str)

            result = await message_service.generate_campaign_messages(
                session,
                campaign_uuid,
                user_uuid,
                step_number=step_number,
                tone_override=tone_override,
            )
            await session.commit()

            return {
                "campaign_id": campaign_id_str,
                "status": "completed",
                "total_contacts": result["total_contacts"],
                "messages_generated": result["messages_generated"],
                "messages_failed": result["messages_failed"],
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to generate campaign messages for %s: %s",
                campaign_id_str,
                str(e),
            )
            return {
                "campaign_id": campaign_id_str,
                "status": "failed",
                "error": str(e),
            }


async def _send_message_impl(message_id_str: str) -> dict:
    """Async implementation for sending a single message."""
    from app.services import message_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            message_uuid = uuid.UUID(message_id_str)

            message = await message_service.send_message(session, message_uuid)
            await session.commit()

            return {
                "message_id": message_id_str,
                "status": message.status,
                "sent_at": message.sent_at.isoformat() if message.sent_at else None,
                "error": message.error_message,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to send message %s: %s",
                message_id_str,
                str(e),
            )
            return {
                "message_id": message_id_str,
                "status": "failed",
                "error": str(e),
            }


async def _send_scheduled_messages_impl() -> dict:
    """Async implementation for sending all scheduled messages that are due."""
    from sqlalchemy import select

    from app.models.message_draft import MessageDraft
    from app.services import message_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            now = datetime.now(timezone.utc)

            stmt = select(MessageDraft).where(
                MessageDraft.status == "approved",
                MessageDraft.scheduled_for.isnot(None),
                MessageDraft.scheduled_for <= now,
                MessageDraft.is_deleted.is_(False),
            )
            result = await session.execute(stmt)
            messages = list(result.scalars().all())

            sent_count = 0
            failed_count = 0

            for msg in messages:
                try:
                    await message_service.send_message(session, msg.id)
                    sent_count += 1
                except Exception as e:
                    logger.error(
                        "Failed to send scheduled message %s: %s",
                        str(msg.id),
                        str(e),
                    )
                    failed_count += 1

            await session.commit()

            return {
                "status": "completed",
                "total_due": len(messages),
                "sent": sent_count,
                "failed": failed_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error("Failed to process scheduled messages: %s", str(e))
            return {
                "status": "failed",
                "error": str(e),
            }


@celery_app.task(name="app.tasks.message_tasks.generate_campaign_messages_task")
def generate_campaign_messages_task(
    campaign_id: str,
    user_id: str,
    step_number: int | None = None,
    tone_override: str | None = None,
) -> dict:
    """Celery task: generate messages for a campaign."""
    return _run_async(
        _generate_campaign_messages_impl(
            campaign_id, user_id, step_number, tone_override
        )
    )


@celery_app.task(name="app.tasks.message_tasks.send_message_task")
def send_message_task(message_id: str) -> dict:
    """Celery task: send a single message."""
    return _run_async(_send_message_impl(message_id))


@celery_app.task(name="app.tasks.message_tasks.send_scheduled_messages_task")
def send_scheduled_messages_task() -> dict:
    """Celery task: send all scheduled messages that are due."""
    return _run_async(_send_scheduled_messages_impl())

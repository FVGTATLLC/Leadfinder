import asyncio
import logging
import uuid

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Helper to run an async coroutine in a sync Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _generate_company_research_impl(
    company_id_str: str,
    user_id_str: str,
) -> dict:
    """Async implementation for company research generation."""
    from app.services import research_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            company_uuid = uuid.UUID(company_id_str)
            user_uuid = uuid.UUID(user_id_str)

            brief = await research_service.generate_company_research(
                session, company_uuid, user_uuid
            )
            await session.commit()

            return {
                "brief_id": str(brief.id),
                "company_id": company_id_str,
                "brief_type": brief.brief_type,
                "status": "completed",
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to generate company research for %s: %s",
                company_id_str,
                str(e),
            )
            return {
                "company_id": company_id_str,
                "status": "failed",
                "error": str(e),
            }


async def _generate_contact_research_impl(
    contact_id_str: str,
    user_id_str: str,
) -> dict:
    """Async implementation for contact research generation."""
    from app.services import research_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            contact_uuid = uuid.UUID(contact_id_str)
            user_uuid = uuid.UUID(user_id_str)

            brief = await research_service.generate_contact_research(
                session, contact_uuid, user_uuid
            )
            await session.commit()

            return {
                "brief_id": str(brief.id),
                "contact_id": contact_id_str,
                "brief_type": brief.brief_type,
                "status": "completed",
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to generate contact research for %s: %s",
                contact_id_str,
                str(e),
            )
            return {
                "contact_id": contact_id_str,
                "status": "failed",
                "error": str(e),
            }


@celery_app.task(name="app.tasks.research_tasks.generate_company_research_task")
def generate_company_research_task(company_id: str, user_id: str) -> dict:
    """Celery task: generate company research brief."""
    return _run_async(_generate_company_research_impl(company_id, user_id))


@celery_app.task(name="app.tasks.research_tasks.generate_contact_research_task")
def generate_contact_research_task(contact_id: str, user_id: str) -> dict:
    """Celery task: generate contact research brief."""
    return _run_async(_generate_contact_research_impl(contact_id, user_id))

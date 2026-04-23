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


async def _enrich_single(contact_id_str: str) -> dict:
    """Async implementation for single contact enrichment."""
    from app.services import enrichment_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            contact_uuid = uuid.UUID(contact_id_str)
            contact = await enrichment_service.enrich_contact(session, contact_uuid)
            await session.commit()
            return {
                "contact_id": contact_id_str,
                "status": contact.enrichment_status,
                "email": contact.email,
                "confidence_score": contact.confidence_score,
            }
        except Exception as e:
            await session.rollback()
            logger.error("Failed to enrich contact %s: %s", contact_id_str, str(e))
            return {
                "contact_id": contact_id_str,
                "status": "failed",
                "error": str(e),
            }


async def _enrich_batch(contact_id_strs: list[str]) -> dict:
    """Async implementation for batch contact enrichment."""
    from app.services import enrichment_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    success_count = 0
    failure_count = 0
    details = []

    for contact_id_str in contact_id_strs:
        async with session_factory() as session:
            try:
                contact_uuid = uuid.UUID(contact_id_str)
                contact = await enrichment_service.enrich_contact(
                    session, contact_uuid
                )
                await session.commit()
                details.append({
                    "contact_id": contact_id_str,
                    "status": contact.enrichment_status,
                    "email": contact.email,
                })
                if contact.enrichment_status == "enriched":
                    success_count += 1
                else:
                    failure_count += 1
            except Exception as e:
                await session.rollback()
                logger.error(
                    "Failed to enrich contact %s: %s", contact_id_str, str(e)
                )
                details.append({
                    "contact_id": contact_id_str,
                    "status": "failed",
                    "error": str(e),
                })
                failure_count += 1

    return {
        "total": len(contact_id_strs),
        "success": success_count,
        "failed": failure_count,
        "details": details,
    }


async def _discover_personas_impl(
    company_id_str: str,
    user_id_str: str,
) -> dict:
    """Async implementation for persona discovery."""
    from app.agents.llm.router import LLMRouter
    from app.agents.persona_agent import PersonaAgent
    from app.models.contact import Contact
    from app.services.company_service import get_company
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            company_uuid = uuid.UUID(company_id_str)
            user_uuid = uuid.UUID(user_id_str)

            company = await get_company(session, company_uuid)

            llm_router = LLMRouter()
            agent = PersonaAgent(llm_router=llm_router, db_session=session)

            result = await agent.execute({
                "company_name": company.name,
                "industry": company.industry,
                "employee_count": company.employee_count,
                "geography": company.geography,
                "domain": company.domain,
                "user_id": user_uuid,
            })

            if not result.success:
                await session.commit()
                return {
                    "company_id": company_id_str,
                    "created": 0,
                    "error": result.error,
                }

            personas = result.data.get("personas", [])
            created_count = 0

            for persona in personas:
                contact = Contact(
                    company_id=company_uuid,
                    first_name=persona.get("first_name") or None,
                    last_name=persona.get("last_name") or None,
                    job_title=persona.get("job_title", ""),
                    persona_type=persona.get("persona_type", "other"),
                    confidence_score=persona.get("confidence_score", 0.5),
                    source="agent",
                    enrichment_status="pending",
                    notes=persona.get("reasoning", ""),
                    created_by=user_uuid,
                )
                session.add(contact)
                created_count += 1

            await session.commit()

            return {
                "company_id": company_id_str,
                "created": created_count,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "Failed to discover personas for company %s: %s",
                company_id_str,
                str(e),
            )
            return {
                "company_id": company_id_str,
                "created": 0,
                "error": str(e),
            }


@celery_app.task(name="app.tasks.enrichment_tasks.enrich_single_contact")
def enrich_single_contact(contact_id: str) -> dict:
    """Celery task: enrich a single contact."""
    return _run_async(_enrich_single(contact_id))


@celery_app.task(name="app.tasks.enrichment_tasks.enrich_contacts_batch")
def enrich_contacts_batch(contact_ids: list[str]) -> dict:
    """Celery task: enrich a batch of contacts sequentially."""
    return _run_async(_enrich_batch(contact_ids))


@celery_app.task(name="app.tasks.enrichment_tasks.discover_personas")
def discover_personas(company_id: str, user_id: str) -> dict:
    """Celery task: discover personas for a company using the Persona Agent."""
    return _run_async(_discover_personas_impl(company_id, user_id))

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


async def _process_export_impl(export_id: str) -> dict:
    """Async implementation: process an export job."""
    from app.services import export_service
    from app.utils.database import get_session_factory

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            job = await export_service.process_export(session, export_id)
            await session.commit()

            return {
                "status": job.status,
                "export_id": export_id,
                "file_url": job.file_url,
                "file_name": job.file_name,
                "record_count": job.record_count,
                "error": job.error_message,
            }

        except Exception as e:
            await session.rollback()
            logger.error("Export task failed for job %s: %s", export_id, str(e))
            return {
                "status": "failed",
                "export_id": export_id,
                "error": str(e),
            }


async def _generate_crm_records_impl(
    campaign_id: str,
    user_id: str,
) -> dict:
    """Async implementation: generate CRM records for a campaign."""
    from sqlalchemy import select

    from app.agents.crm_agent import CRMAgent
    from app.agents.llm.router import LLMRouter
    from app.models.campaign import Campaign, CampaignContact
    from app.models.company import Company
    from app.models.contact import Contact
    from app.models.crm_record import CRMRecord
    from app.models.message_draft import MessageDraft
    from app.utils.database import get_session_factory

    campaign_uuid = uuid.UUID(campaign_id)
    user_uuid = uuid.UUID(user_id)

    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            # Get campaign contacts
            cc_stmt = (
                select(CampaignContact)
                .where(CampaignContact.campaign_id == campaign_uuid)
            )
            cc_result = await session.execute(cc_stmt)
            campaign_contacts = list(cc_result.scalars().all())

            if not campaign_contacts:
                return {
                    "status": "completed",
                    "campaign_id": campaign_id,
                    "records_created": 0,
                    "message": "No contacts found in campaign",
                }

            # Collect unique company IDs and contact IDs
            contact_ids = [cc.contact_id for cc in campaign_contacts]
            company_ids_set = set()

            # Fetch contacts
            contacts_stmt = select(Contact).where(Contact.id.in_(contact_ids))
            contacts_result = await session.execute(contacts_stmt)
            contacts = list(contacts_result.scalars().all())

            contacts_data = []
            for ct in contacts:
                company_ids_set.add(ct.company_id)
                contacts_data.append({
                    "id": str(ct.id),
                    "first_name": ct.first_name,
                    "last_name": ct.last_name,
                    "email": ct.email,
                    "phone": ct.phone,
                    "job_title": ct.job_title,
                    "persona_type": ct.persona_type,
                    "linkedin_url": ct.linkedin_url,
                    "company_id": str(ct.company_id),
                    "company_name": ct.company.name if ct.company else None,
                })

            # Fetch companies
            companies_stmt = select(Company).where(
                Company.id.in_(list(company_ids_set))
            )
            companies_result = await session.execute(companies_stmt)
            companies = list(companies_result.scalars().all())

            companies_data = []
            for c in companies:
                companies_data.append({
                    "id": str(c.id),
                    "name": c.name,
                    "domain": c.domain,
                    "industry": c.industry,
                    "sub_industry": c.sub_industry,
                    "country": c.country,
                    "city": c.city,
                    "geography": c.geography,
                    "employee_count": c.employee_count,
                    "revenue_range": c.revenue_range,
                    "icp_score": c.icp_score,
                    "linkedin_url": c.linkedin_url,
                    "website": c.website,
                })

            # Fetch sent/replied messages for this campaign
            messages_stmt = (
                select(MessageDraft)
                .where(
                    MessageDraft.campaign_id == campaign_uuid,
                    MessageDraft.is_deleted.is_(False),
                    MessageDraft.status.in_(["sent", "replied"]),
                )
            )
            messages_result = await session.execute(messages_stmt)
            messages = list(messages_result.scalars().all())

            activities_data = []
            for m in messages:
                activities_data.append({
                    "id": str(m.id),
                    "subject": m.subject,
                    "body": m.body,
                    "status": m.status,
                    "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                    "replied_at": m.replied_at.isoformat() if m.replied_at else None,
                    "contact_id": str(m.contact_id),
                    "campaign_id": str(m.campaign_id),
                })

            # Use CRM Agent to transform data
            llm_router = LLMRouter()
            crm_agent = CRMAgent(llm_router=llm_router, db_session=session)

            result = await crm_agent.execute({
                "companies": companies_data,
                "contacts": contacts_data,
                "activities": activities_data,
                "summarize_activities": False,
                "user_id": user_uuid,
            })

            if not result.success:
                return {
                    "status": "failed",
                    "campaign_id": campaign_id,
                    "error": result.error,
                }

            # Save CRM records to database
            records_created = 0
            for record_data in result.data.get("records", []):
                crm_record = CRMRecord(
                    record_type=record_data["record_type"],
                    company_id=(
                        uuid.UUID(record_data["company_id"])
                        if record_data.get("company_id")
                        else None
                    ),
                    contact_id=(
                        uuid.UUID(record_data["contact_id"])
                        if record_data.get("contact_id")
                        else None
                    ),
                    campaign_id=campaign_uuid,
                    data=record_data["data"],
                    created_by=user_uuid,
                )
                session.add(crm_record)
                records_created += 1

            await session.flush()
            await session.commit()

            return {
                "status": "completed",
                "campaign_id": campaign_id,
                "records_created": records_created,
            }

        except Exception as e:
            await session.rollback()
            logger.error(
                "CRM record generation failed for campaign %s: %s",
                campaign_id,
                str(e),
            )
            return {
                "status": "failed",
                "campaign_id": campaign_id,
                "error": str(e),
            }


# ------------------------------------------------------------------
# Celery tasks
# ------------------------------------------------------------------


@celery_app.task(name="app.tasks.export_tasks.process_export_task")
def process_export_task(export_id: str) -> dict:
    """Celery task: process an export job."""
    logger.info(
        "Processing export job %s at %s",
        export_id,
        datetime.now(timezone.utc).isoformat(),
    )
    return _run_async(_process_export_impl(export_id))


@celery_app.task(name="app.tasks.export_tasks.generate_crm_records_task")
def generate_crm_records_task(campaign_id: str, user_id: str) -> dict:
    """Celery task: generate CRM records for a campaign."""
    logger.info(
        "Generating CRM records for campaign %s by user %s",
        campaign_id,
        user_id,
    )
    return _run_async(_generate_crm_records_impl(campaign_id, user_id))

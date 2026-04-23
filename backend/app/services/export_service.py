import csv
import io
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import NotFoundError
from app.models.activity_log import ActivityLog
from app.models.campaign import Campaign, CampaignContact
from app.models.company import Company
from app.models.contact import Contact
from app.models.crm_record import CRMRecord
from app.models.export_job import ExportJob
from app.models.message_draft import MessageDraft
from app.schemas.export import ExportRequest
from app.utils.gcs_client import get_storage_client
from app.utils.pagination import PaginationParams, paginate

logger = logging.getLogger(__name__)


async def create_export_job(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: ExportRequest,
) -> ExportJob:
    """Create a new export job record."""
    job = ExportJob(
        export_type=data.export_type.value,
        filters=data.filters,
        status="pending",
        created_by=user_id,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def get_export_job(db: AsyncSession, export_id: uuid.UUID) -> ExportJob:
    """Get a single export job by ID."""
    stmt = select(ExportJob).where(
        ExportJob.id == export_id,
        ExportJob.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundError(f"Export job with id '{export_id}' not found")
    return job


async def list_export_jobs(
    db: AsyncSession,
    user_id: uuid.UUID,
    pagination: PaginationParams | None = None,
) -> dict:
    """List export jobs for a user with pagination."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(ExportJob)
        .where(
            ExportJob.created_by == user_id,
            ExportJob.is_deleted.is_(False),
        )
        .order_by(ExportJob.created_at.desc())
    )

    return await paginate(db, query, pagination)


async def generate_companies_csv(
    db: AsyncSession,
    filters: dict | None = None,
) -> tuple[str, int]:
    """Generate CSV content for companies export."""
    stmt = select(Company).where(Company.is_deleted.is_(False))

    if filters:
        if filters.get("industry"):
            stmt = stmt.where(Company.industry == filters["industry"])
        if filters.get("country"):
            stmt = stmt.where(Company.country == filters["country"])
        if filters.get("min_employees"):
            stmt = stmt.where(Company.employee_count >= filters["min_employees"])

    stmt = stmt.order_by(Company.created_at.desc())
    result = await db.execute(stmt)
    companies = list(result.scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Domain", "Industry", "Sub-Industry", "Geography",
        "City", "Country", "Employee Count", "Revenue Range",
        "Travel Intensity", "ICP Score", "Source", "LinkedIn URL",
        "Website", "Created At",
    ])

    for c in companies:
        writer.writerow([
            str(c.id), c.name, c.domain or "", c.industry or "",
            c.sub_industry or "", c.geography or "", c.city or "",
            c.country or "", c.employee_count or "", c.revenue_range or "",
            c.travel_intensity or "", c.icp_score or "", c.source or "",
            c.linkedin_url or "", c.website or "",
            c.created_at.isoformat() if c.created_at else "",
        ])

    return output.getvalue(), len(companies)


async def generate_contacts_csv(
    db: AsyncSession,
    filters: dict | None = None,
) -> tuple[str, int]:
    """Generate CSV content for contacts export."""
    stmt = select(Contact).where(Contact.is_deleted.is_(False))

    if filters:
        if filters.get("company_id"):
            stmt = stmt.where(Contact.company_id == uuid.UUID(filters["company_id"]))
        if filters.get("enrichment_status"):
            stmt = stmt.where(Contact.enrichment_status == filters["enrichment_status"])
        if filters.get("persona_type"):
            stmt = stmt.where(Contact.persona_type == filters["persona_type"])

    stmt = stmt.order_by(Contact.created_at.desc())
    result = await db.execute(stmt)
    contacts = list(result.scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "First Name", "Last Name", "Email", "Email Verified",
        "Phone", "Job Title", "Persona Type", "LinkedIn URL",
        "Confidence Score", "Enrichment Status", "Company ID",
        "Company Name", "Source", "Created At",
    ])

    for ct in contacts:
        company_name = ct.company.name if ct.company else ""
        writer.writerow([
            str(ct.id), ct.first_name or "", ct.last_name or "",
            ct.email or "", ct.email_verified, ct.phone or "",
            ct.job_title or "", ct.persona_type or "",
            ct.linkedin_url or "", ct.confidence_score or "",
            ct.enrichment_status, str(ct.company_id),
            company_name, ct.source or "",
            ct.created_at.isoformat() if ct.created_at else "",
        ])

    return output.getvalue(), len(contacts)


async def generate_activities_csv(
    db: AsyncSession,
    filters: dict | None = None,
) -> tuple[str, int]:
    """Generate CSV content for activity logs export."""
    stmt = select(ActivityLog).order_by(ActivityLog.created_at.desc())

    if filters:
        if filters.get("action"):
            stmt = stmt.where(ActivityLog.action == filters["action"])
        if filters.get("entity_type"):
            stmt = stmt.where(ActivityLog.entity_type == filters["entity_type"])
        if filters.get("user_id"):
            stmt = stmt.where(
                ActivityLog.user_id == uuid.UUID(filters["user_id"])
            )

    result = await db.execute(stmt)
    activities = list(result.scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "User ID", "Action", "Entity Type", "Entity ID",
        "Details", "IP Address", "Created At",
    ])

    for a in activities:
        writer.writerow([
            str(a.id), str(a.user_id), a.action, a.entity_type,
            str(a.entity_id), str(a.details) if a.details else "",
            a.ip_address or "",
            a.created_at.isoformat() if a.created_at else "",
        ])

    return output.getvalue(), len(activities)


async def generate_crm_export(
    db: AsyncSession,
    filters: dict | None = None,
) -> tuple[str, int]:
    """Generate combined CRM export with accounts, contacts, and activities."""
    output = io.StringIO()
    writer = csv.writer(output)
    total_records = 0

    # Section 1: Accounts (Companies)
    writer.writerow(["--- ACCOUNTS ---"])
    writer.writerow([
        "Record Type", "ID", "Name", "Domain", "Industry", "Country",
        "Employee Count", "Revenue Range", "ICP Score",
    ])

    companies_stmt = select(Company).where(Company.is_deleted.is_(False))
    if filters and filters.get("campaign_id"):
        # Filter companies that are in the campaign via contacts
        campaign_uuid = uuid.UUID(filters["campaign_id"])
        contact_company_ids = (
            select(Contact.company_id)
            .join(CampaignContact, CampaignContact.contact_id == Contact.id)
            .where(CampaignContact.campaign_id == campaign_uuid)
            .distinct()
        )
        companies_stmt = companies_stmt.where(Company.id.in_(contact_company_ids))

    companies_result = await db.execute(companies_stmt)
    companies = list(companies_result.scalars().all())

    for c in companies:
        writer.writerow([
            "account", str(c.id), c.name, c.domain or "",
            c.industry or "", c.country or "",
            c.employee_count or "", c.revenue_range or "",
            c.icp_score or "",
        ])
        total_records += 1

    # Section 2: Contacts
    writer.writerow([])
    writer.writerow(["--- CONTACTS ---"])
    writer.writerow([
        "Record Type", "ID", "First Name", "Last Name", "Email",
        "Phone", "Job Title", "Company ID", "Company Name",
    ])

    contacts_stmt = select(Contact).where(Contact.is_deleted.is_(False))
    if filters and filters.get("campaign_id"):
        campaign_uuid = uuid.UUID(filters["campaign_id"])
        campaign_contact_ids = (
            select(CampaignContact.contact_id)
            .where(CampaignContact.campaign_id == campaign_uuid)
        )
        contacts_stmt = contacts_stmt.where(Contact.id.in_(campaign_contact_ids))

    contacts_result = await db.execute(contacts_stmt)
    contacts = list(contacts_result.scalars().all())

    for ct in contacts:
        company_name = ct.company.name if ct.company else ""
        writer.writerow([
            "contact", str(ct.id), ct.first_name or "", ct.last_name or "",
            ct.email or "", ct.phone or "", ct.job_title or "",
            str(ct.company_id), company_name,
        ])
        total_records += 1

    # Section 3: Activities (messages as activities)
    writer.writerow([])
    writer.writerow(["--- ACTIVITIES ---"])
    writer.writerow([
        "Record Type", "ID", "Contact ID", "Campaign ID", "Subject",
        "Status", "Sent At", "Replied At",
    ])

    messages_stmt = select(MessageDraft).where(
        MessageDraft.is_deleted.is_(False),
        MessageDraft.status.in_(["sent", "replied"]),
    )
    if filters and filters.get("campaign_id"):
        campaign_uuid = uuid.UUID(filters["campaign_id"])
        messages_stmt = messages_stmt.where(
            MessageDraft.campaign_id == campaign_uuid
        )

    messages_result = await db.execute(messages_stmt)
    messages = list(messages_result.scalars().all())

    for m in messages:
        writer.writerow([
            "activity", str(m.id), str(m.contact_id), str(m.campaign_id),
            m.subject or "", m.status,
            m.sent_at.isoformat() if m.sent_at else "",
            m.replied_at.isoformat() if m.replied_at else "",
        ])
        total_records += 1

    return output.getvalue(), total_records


async def generate_campaign_report_csv(
    db: AsyncSession,
    campaign_id: str,
) -> tuple[str, int]:
    """Generate a campaign-specific report CSV."""
    campaign_uuid = uuid.UUID(campaign_id)

    # Get campaign
    campaign_stmt = select(Campaign).where(Campaign.id == campaign_uuid)
    campaign_result = await db.execute(campaign_stmt)
    campaign = campaign_result.scalar_one_or_none()
    if campaign is None:
        raise NotFoundError(f"Campaign '{campaign_id}' not found")

    output = io.StringIO()
    writer = csv.writer(output)
    total_records = 0

    # Campaign header
    writer.writerow(["Campaign Report"])
    writer.writerow(["Campaign Name", campaign.name])
    writer.writerow(["Campaign Type", campaign.campaign_type])
    writer.writerow(["Status", campaign.status])
    writer.writerow(["Started At", campaign.starts_at.isoformat() if campaign.starts_at else "N/A"])
    writer.writerow([])

    # Contacts and their message statuses
    writer.writerow([
        "Contact ID", "First Name", "Last Name", "Email", "Company",
        "Job Title", "Campaign Status", "Current Step",
        "Messages Sent", "Last Message Status", "Last Sent At", "Replied At",
    ])

    cc_stmt = (
        select(CampaignContact)
        .where(CampaignContact.campaign_id == campaign_uuid)
        .order_by(CampaignContact.added_at)
    )
    cc_result = await db.execute(cc_stmt)
    campaign_contacts = list(cc_result.scalars().all())

    for cc in campaign_contacts:
        contact = cc.contact
        if contact is None:
            continue

        company_name = contact.company.name if contact.company else ""

        # Get message stats for this contact in this campaign
        msg_stmt = (
            select(MessageDraft)
            .where(
                MessageDraft.campaign_id == campaign_uuid,
                MessageDraft.contact_id == cc.contact_id,
                MessageDraft.is_deleted.is_(False),
            )
            .order_by(MessageDraft.created_at.desc())
        )
        msg_result = await db.execute(msg_stmt)
        messages = list(msg_result.scalars().all())

        messages_sent_count = sum(
            1 for m in messages if m.status in ("sent", "replied")
        )
        last_msg = messages[0] if messages else None
        last_status = last_msg.status if last_msg else ""
        last_sent = (
            last_msg.sent_at.isoformat()
            if last_msg and last_msg.sent_at
            else ""
        )
        replied_at = (
            last_msg.replied_at.isoformat()
            if last_msg and last_msg.replied_at
            else ""
        )

        writer.writerow([
            str(cc.contact_id),
            contact.first_name or "",
            contact.last_name or "",
            contact.email or "",
            company_name,
            contact.job_title or "",
            cc.status,
            cc.current_step,
            messages_sent_count,
            last_status,
            last_sent,
            replied_at,
        ])
        total_records += 1

    return output.getvalue(), total_records


def upload_to_gcs(content: str, filename: str, bucket: str) -> str:
    """Upload CSV string to GCS or local storage, return URL."""
    client = get_storage_client()
    url = client.upload_string(content, filename)
    return url


async def process_export(db: AsyncSession, export_id: str) -> ExportJob:
    """Main export processor: generates CSV, uploads, updates job status."""
    export_uuid = uuid.UUID(export_id)
    job = await get_export_job(db, export_uuid)

    job.status = "processing"
    job.started_at = datetime.now(timezone.utc)
    await db.flush()

    try:
        export_type = job.export_type
        filters = job.filters

        if export_type == "companies":
            csv_content, record_count = await generate_companies_csv(db, filters)
        elif export_type == "contacts":
            csv_content, record_count = await generate_contacts_csv(db, filters)
        elif export_type == "activities":
            csv_content, record_count = await generate_activities_csv(db, filters)
        elif export_type == "crm_full":
            csv_content, record_count = await generate_crm_export(db, filters)
        elif export_type == "campaign_report":
            campaign_id = filters.get("campaign_id") if filters else None
            if not campaign_id:
                raise ValueError("campaign_id is required for campaign_report export")
            csv_content, record_count = await generate_campaign_report_csv(
                db, campaign_id
            )
        else:
            raise ValueError(f"Unknown export type: {export_type}")

        # Generate filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"exports/{export_type}_{timestamp}_{export_id[:8]}.csv"

        # Upload
        file_url = upload_to_gcs(csv_content, filename, settings.GCS_BUCKET)

        # Update job
        job.status = "completed"
        job.file_url = file_url
        job.file_name = filename.split("/")[-1]
        job.file_size = len(csv_content.encode("utf-8"))
        job.record_count = record_count
        job.completed_at = datetime.now(timezone.utc)

        await db.flush()
        await db.refresh(job)
        return job

    except Exception as e:
        logger.error("Export processing failed for job %s: %s", export_id, str(e))
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(job)
        return job

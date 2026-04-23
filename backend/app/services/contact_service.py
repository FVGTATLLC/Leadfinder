import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.contact import Contact
from app.schemas.contact import (
    ContactCreate,
    ContactListResponse,
    ContactUpdate,
)
from app.utils.email_validator import normalize_email
from app.utils.pagination import PaginationParams, paginate


async def create_contact(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: ContactCreate,
) -> Contact:
    """Create a new contact, checking for email+company_id duplicates."""
    if data.email:
        normalized = normalize_email(data.email)
        stmt = select(Contact).where(
            Contact.email == normalized,
            Contact.company_id == data.company_id,
            Contact.is_deleted.is_(False),
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise ConflictError(
                f"Contact with email '{data.email}' already exists for this company"
            )

    contact = Contact(
        company_id=data.company_id,
        first_name=data.first_name,
        last_name=data.last_name,
        email=normalize_email(data.email) if data.email else None,
        phone=data.phone,
        job_title=data.job_title,
        persona_type=data.persona_type.value if data.persona_type else None,
        linkedin_url=data.linkedin_url,
        source=data.source,
        notes=data.notes,
        is_primary=data.is_primary,
        created_by=user_id,
    )
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact


async def get_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
) -> Contact:
    """Get a single contact by ID with company relationship loaded."""
    stmt = select(Contact).where(
        Contact.id == contact_id,
        Contact.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    contact = result.scalar_one_or_none()
    if contact is None:
        raise NotFoundError(f"Contact with id '{contact_id}' not found")
    return contact


async def list_contacts(
    db: AsyncSession,
    company_id: uuid.UUID | None = None,
    persona_type: str | None = None,
    enrichment_status: str | None = None,
    search: str | None = None,
    pagination: PaginationParams | None = None,
    user_id: uuid.UUID | str | None = None,
    user_role: str | None = None,
) -> dict:
    """List contacts with optional filters and search."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Contact)
        .where(Contact.is_deleted.is_(False))
        .order_by(Contact.created_at.desc())
    )

    # Non-admin users only see their own contacts
    if user_role and user_role != "admin" and user_id:
        query = query.where(Contact.created_by == user_id)

    if company_id:
        query = query.where(Contact.company_id == company_id)
    if persona_type:
        query = query.where(Contact.persona_type == persona_type)
    if enrichment_status:
        query = query.where(Contact.enrichment_status == enrichment_status)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Contact.first_name.ilike(search_term),
                Contact.last_name.ilike(search_term),
                Contact.email.ilike(search_term),
                Contact.job_title.ilike(search_term),
            )
        )

    result = await paginate(db, query, pagination)
    result["items"] = [
        ContactListResponse.from_contact(c) for c in result["items"]
    ]
    return result


async def update_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
    data: ContactUpdate,
) -> Contact:
    """Update an existing contact."""
    contact = await get_contact(db, contact_id)
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        normalized = normalize_email(update_data["email"])
        stmt = select(Contact).where(
            Contact.email == normalized,
            Contact.company_id == contact.company_id,
            Contact.id != contact_id,
            Contact.is_deleted.is_(False),
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            raise ConflictError(
                f"Contact with email '{update_data['email']}' already exists for this company"
            )
        update_data["email"] = normalized

    if "persona_type" in update_data and update_data["persona_type"] is not None:
        update_data["persona_type"] = update_data["persona_type"].value

    for field, value in update_data.items():
        setattr(contact, field, value)

    await db.flush()
    await db.refresh(contact)
    return contact


async def delete_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
) -> None:
    """Soft delete a contact."""
    contact = await get_contact(db, contact_id)
    contact.is_deleted = True
    await db.flush()


async def get_company_contacts(
    db: AsyncSession,
    company_id: uuid.UUID,
    pagination: PaginationParams | None = None,
) -> dict:
    """Get all contacts for a specific company."""
    if pagination is None:
        pagination = PaginationParams()

    query = (
        select(Contact)
        .where(
            Contact.company_id == company_id,
            Contact.is_deleted.is_(False),
        )
        .order_by(Contact.is_primary.desc(), Contact.created_at.desc())
    )

    result = await paginate(db, query, pagination)
    result["items"] = [
        ContactListResponse.from_contact(c) for c in result["items"]
    ]
    return result


async def bulk_create_contacts(
    db: AsyncSession,
    user_id: uuid.UUID,
    contacts: list[ContactCreate],
) -> dict:
    """Bulk create contacts, skipping duplicates."""
    created = 0
    skipped = 0

    for contact_data in contacts:
        if contact_data.email:
            normalized = normalize_email(contact_data.email)
            stmt = select(Contact).where(
                Contact.email == normalized,
                Contact.company_id == contact_data.company_id,
                Contact.is_deleted.is_(False),
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                skipped += 1
                continue

        try:
            contact = Contact(
                company_id=contact_data.company_id,
                first_name=contact_data.first_name,
                last_name=contact_data.last_name,
                email=normalize_email(contact_data.email) if contact_data.email else None,
                phone=contact_data.phone,
                job_title=contact_data.job_title,
                persona_type=contact_data.persona_type.value if contact_data.persona_type else None,
                linkedin_url=contact_data.linkedin_url,
                source=contact_data.source,
                notes=contact_data.notes,
                is_primary=contact_data.is_primary,
                created_by=user_id,
            )
            db.add(contact)
            await db.flush()
            created += 1
        except Exception:
            skipped += 1

    return {
        "created": created,
        "skipped": skipped,
    }


async def update_enrichment_status(
    db: AsyncSession,
    contact_id: uuid.UUID,
    status: str,
    enrichment_data: dict,
) -> Contact:
    """Update enrichment status and data for a contact."""
    contact = await get_contact(db, contact_id)

    contact.enrichment_status = status
    if enrichment_data.get("email"):
        contact.email = normalize_email(enrichment_data["email"])
    if enrichment_data.get("linkedin_url"):
        contact.linkedin_url = enrichment_data["linkedin_url"]
    if enrichment_data.get("confidence_score") is not None:
        contact.confidence_score = enrichment_data["confidence_score"]
    if enrichment_data.get("enrichment_source"):
        contact.enrichment_source = enrichment_data["enrichment_source"]
    if status == "enriched":
        contact.enriched_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(contact)
    return contact


async def set_primary_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
    company_id: uuid.UUID,
) -> Contact:
    """Set a contact as primary, unsetting other primaries for the same company."""
    # Unset existing primaries for this company
    stmt = select(Contact).where(
        Contact.company_id == company_id,
        Contact.is_primary.is_(True),
        Contact.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    current_primaries = result.scalars().all()
    for c in current_primaries:
        c.is_primary = False

    # Set the new primary
    contact = await get_contact(db, contact_id)
    contact.is_primary = True

    await db.flush()
    await db.refresh(contact)
    return contact

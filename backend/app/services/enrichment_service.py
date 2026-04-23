import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models.contact import Contact
from app.services.contact_service import get_contact, update_enrichment_status
from app.utils.email_validator import (
    generate_email_patterns,
    normalize_email,
    validate_email_format,
)


async def enrich_contact(
    db: AsyncSession,
    contact_id: uuid.UUID,
) -> Contact:
    """
    Enrich a single contact with email pattern generation.

    Gets contact and company data, attempts to generate email if missing,
    and updates enrichment status accordingly.
    """
    contact = await get_contact(db, contact_id)
    company = contact.company

    if not company:
        await update_enrichment_status(
            db,
            contact_id,
            "failed",
            {"enrichment_source": "agent"},
        )
        raise NotFoundError(
            f"Company not found for contact '{contact_id}'"
        )

    enrichment_data: dict = {
        "enrichment_source": "agent",
    }

    enriched = False

    # Try email pattern generation if no email and we have name + domain
    if not contact.email and contact.first_name and contact.last_name:
        domain = company.domain
        if domain:
            patterns = generate_email_patterns(
                contact.first_name,
                contact.last_name,
                domain,
            )
            if patterns:
                # Use the most common corporate pattern (first.last@domain)
                best_candidate = patterns[0]
                if validate_email_format(best_candidate):
                    enrichment_data["email"] = best_candidate
                    enrichment_data["confidence_score"] = 0.7
                    enriched = True

    # If contact already has an email, validate it
    if contact.email and validate_email_format(contact.email):
        enrichment_data["confidence_score"] = max(
            enrichment_data.get("confidence_score", 0.0),
            0.8,
        )
        enriched = True

    # Set linkedin suggestion from company domain if missing
    if not contact.linkedin_url and contact.first_name and contact.last_name:
        enrichment_data["linkedin_url"] = (
            f"https://www.linkedin.com/in/"
            f"{contact.first_name.lower()}-{contact.last_name.lower()}"
        )
        if not enriched:
            enrichment_data["confidence_score"] = 0.3

    status = "enriched" if enriched else "failed"
    contact = await update_enrichment_status(
        db,
        contact_id,
        status,
        enrichment_data,
    )
    return contact


async def bulk_enrich_contacts(
    db: AsyncSession,
    contact_ids: list[uuid.UUID],
) -> dict:
    """
    Enrich multiple contacts.

    Returns a summary dict with results per contact.
    """
    results: dict = {
        "success": 0,
        "failed": 0,
        "details": [],
    }

    for contact_id in contact_ids:
        try:
            contact = await enrich_contact(db, contact_id)
            results["details"].append({
                "contact_id": str(contact.id),
                "status": contact.enrichment_status,
                "email": contact.email,
                "confidence_score": contact.confidence_score,
            })
            if contact.enrichment_status == "enriched":
                results["success"] += 1
            else:
                results["failed"] += 1
        except Exception as e:
            results["details"].append({
                "contact_id": str(contact_id),
                "status": "failed",
                "error": str(e),
            })
            results["failed"] += 1

    return results

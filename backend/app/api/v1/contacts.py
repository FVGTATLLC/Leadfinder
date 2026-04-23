import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.schemas.contact import (
    BulkEnrichRequest,
    ContactCreate,
    ContactEnrichResponse,
    ContactListResponse,
    ContactResponse,
    ContactUpdate,
    PersonaDiscoveryResponse,
)
from app.schemas.user import TokenPayload
from app.services import contact_service
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter(prefix="/contacts", tags=["contacts"])


class EnrichTaskResponse(BaseModel):
    task_id: str
    status: str = "queued"


class BulkEnrichTaskResponse(BaseModel):
    task_id: str
    status: str = "queued"
    contact_count: int


class PersonaTaskResponse(BaseModel):
    task_id: str
    status: str = "queued"
    company_id: uuid.UUID


@router.get("", response_model=PaginatedResponse[ContactListResponse])
async def list_contacts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    company_id: uuid.UUID | None = Query(default=None),
    persona_type: str | None = Query(default=None),
    enrichment_status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=300),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await contact_service.list_contacts(
        db,
        company_id=company_id,
        persona_type=persona_type,
        enrichment_status=enrichment_status,
        search=search,
        pagination=params,
        user_id=current_user.sub,
        user_role=current_user.role,
    )
    return result


@router.post("", response_model=ContactResponse, status_code=201)
async def create_contact(
    data: ContactCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ContactResponse:
    contact = await contact_service.create_contact(
        db, uuid.UUID(current_user.sub), data
    )
    return ContactResponse.from_contact(contact)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ContactResponse:
    contact = await contact_service.get_contact(db, contact_id)
    return ContactResponse.from_contact(contact)


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ContactResponse:
    contact = await contact_service.update_contact(db, contact_id, data)
    return ContactResponse.from_contact(contact)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> None:
    await contact_service.delete_contact(db, contact_id)


@router.post("/{contact_id}/enrich", response_model=EnrichTaskResponse)
async def enrich_contact(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> EnrichTaskResponse:
    """Enrich a single contact using the Enrichment Agent (synchronous)."""
    import logging
    from app.agents.llm.router import LLMRouter
    from app.agents.enrichment_agent import EnrichmentAgent

    logger = logging.getLogger(__name__)

    contact = await contact_service.get_contact(db, contact_id)

    try:
        llm_router = LLMRouter()
        agent = EnrichmentAgent(llm_router=llm_router, db_session=db)

        result = await agent.execute({
            "contact_id": str(contact_id),
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "job_title": contact.job_title,
            "company_name": contact.company.name if contact.company else None,
            "company_domain": contact.company.domain if contact.company else None,
        })

        if result.success:
            enrichment = result.data.get("enrichment", {})
            if enrichment.get("email"):
                contact.email = enrichment["email"]
            if enrichment.get("linkedin_url"):
                contact.linkedin_url = enrichment["linkedin_url"]
            if enrichment.get("confidence_score"):
                contact.confidence_score = enrichment["confidence_score"]
            contact.enrichment_status = "enriched"
            await db.flush()
            await db.refresh(contact)

        return EnrichTaskResponse(task_id=str(contact_id), status="completed")
    except Exception as e:
        logger.error("Enrichment failed for contact %s: %s", contact_id, str(e))
        return EnrichTaskResponse(task_id=str(contact_id), status="failed")


@router.post("/bulk-enrich", response_model=BulkEnrichTaskResponse)
async def bulk_enrich_contacts(
    data: BulkEnrichRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> BulkEnrichTaskResponse:
    """Bulk enrich contacts (synchronous, processes sequentially)."""
    import logging
    from app.agents.llm.router import LLMRouter
    from app.agents.enrichment_agent import EnrichmentAgent

    logger = logging.getLogger(__name__)

    llm_router = LLMRouter()
    agent = EnrichmentAgent(llm_router=llm_router, db_session=db)

    for cid in data.contact_ids:
        try:
            contact = await contact_service.get_contact(db, cid)
            result = await agent.execute({
                "contact_id": str(cid),
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "job_title": contact.job_title,
                "company_name": contact.company.name if contact.company else None,
                "company_domain": contact.company.domain if contact.company else None,
            })
            if result.success:
                enrichment = result.data.get("enrichment", {})
                if enrichment.get("email"):
                    contact.email = enrichment["email"]
                if enrichment.get("linkedin_url"):
                    contact.linkedin_url = enrichment["linkedin_url"]
                contact.enrichment_status = "enriched"
                await db.flush()
        except Exception as e:
            logger.error("Enrichment failed for contact %s: %s", cid, str(e))

    return BulkEnrichTaskResponse(
        task_id="sync",
        status="completed",
        contact_count=len(data.contact_ids),
    )


@router.get(
    "/company/{company_id}",
    response_model=PaginatedResponse[ContactListResponse],
)
async def get_company_contacts(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=300),
) -> dict:
    params = PaginationParams(page=page, per_page=per_page)
    result = await contact_service.get_company_contacts(
        db, company_id, pagination=params
    )
    return result


class ApolloVerifyResponse(BaseModel):
    verified: bool
    contact: dict
    apollo_data: dict | None = None
    message: str | None = None


@router.post("/{contact_id}/verify-apollo", response_model=ApolloVerifyResponse)
async def verify_contact_apollo(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ApolloVerifyResponse:
    """Verify a contact using Apollo.io people/match (uses 1 Apollo credit)."""
    import logging
    import httpx
    from app.config import settings
    from app.services.company_service import get_company

    logger = logging.getLogger(__name__)

    contact = await contact_service.get_contact(db, contact_id)

    # Get company for domain
    company = None
    if contact.company_id:
        try:
            company = await get_company(db, contact.company_id)
        except Exception:
            pass

    company_name = company.name if company else (contact.company_name if hasattr(contact, "company_name") else None)
    domain = company.domain if company else None

    # Call Apollo people/match
    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY,
    }
    body = {
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "organization_name": company_name,
        "domain": domain,
        "reveal_personal_emails": True,
        "reveal_phone_number": True,
    }

    person = None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/people/match",
                headers=headers,
                json=body,
            )
            if resp.status_code == 200:
                person = resp.json().get("person")
    except Exception as e:
        logger.error("Apollo API call failed for contact %s: %s", contact_id, str(e))

    if not person:
        from app.schemas.contact import ContactResponse

        return ApolloVerifyResponse(
            verified=False,
            contact=ContactResponse.from_contact(contact).model_dump(mode="json"),
            message="Contact not found in Apollo database",
        )

    # Update contact fields from Apollo data
    apollo_email = person.get("email")
    apollo_linkedin = person.get("linkedin_url")
    apollo_title = person.get("title")
    phone_numbers = person.get("phone_numbers") or []
    apollo_phone = phone_numbers[0].get("sanitized_number") if phone_numbers else None

    if apollo_email:
        contact.email = apollo_email
    if apollo_linkedin:
        contact.linkedin_url = apollo_linkedin
    if apollo_phone:
        contact.phone = apollo_phone
    contact.enrichment_status = "verified"
    contact.confidence_score = 0.95
    contact.enrichment_source = "apollo"

    await db.flush()
    await db.refresh(contact)

    from app.schemas.contact import ContactResponse

    return ApolloVerifyResponse(
        verified=True,
        contact=ContactResponse.from_contact(contact).model_dump(mode="json"),
        apollo_data={
            "email": apollo_email,
            "title": apollo_title,
            "linkedin": apollo_linkedin,
            "phone": apollo_phone,
        },
    )


class ApolloLookupRequest(BaseModel):
    first_name: str
    last_name: str
    company_name: str | None = None
    domain: str | None = None
    linkedin_url: str | None = None


class ApolloLookupResponse(BaseModel):
    found: bool
    email: str | None = None
    email_status: str | None = None
    title: str | None = None
    linkedin_url: str | None = None
    phone: str | None = None
    photo_url: str | None = None
    city: str | None = None
    country: str | None = None
    seniority: str | None = None
    message: str | None = None


@router.post("/lookup-apollo", response_model=ApolloLookupResponse)
async def lookup_apollo(
    request: ApolloLookupRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ApolloLookupResponse:
    """Look up a person in Apollo without needing a saved contact ID.
    Used to verify discovered personas before saving them.
    Uses 1 Apollo credit per call."""
    import logging
    import httpx
    from app.config import settings

    logger = logging.getLogger(__name__)

    if not settings.APOLLO_API_KEY:
        return ApolloLookupResponse(found=False, message="Apollo API key not configured")

    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.APOLLO_API_KEY,
    }
    body = {
        "first_name": request.first_name,
        "last_name": request.last_name,
        "reveal_personal_emails": True,
        "reveal_phone_number": True,
    }
    if request.company_name:
        body["organization_name"] = request.company_name
    if request.domain:
        body["domain"] = request.domain
    if request.linkedin_url:
        body["linkedin_url"] = request.linkedin_url

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/people/match",
                headers=headers,
                json=body,
            )
            if resp.status_code != 200:
                return ApolloLookupResponse(
                    found=False,
                    message=f"Apollo returned {resp.status_code}",
                )
            person = resp.json().get("person")
    except Exception as e:
        logger.error("Apollo lookup failed: %s", str(e))
        return ApolloLookupResponse(found=False, message=str(e))

    if not person:
        return ApolloLookupResponse(found=False, message="Person not found in Apollo")

    phone_numbers = person.get("phone_numbers") or []
    phone = phone_numbers[0].get("sanitized_number") if phone_numbers else None

    return ApolloLookupResponse(
        found=True,
        email=person.get("email"),
        email_status=person.get("email_status"),
        title=person.get("title"),
        linkedin_url=person.get("linkedin_url"),
        phone=phone,
        photo_url=person.get("photo_url"),
        city=person.get("city"),
        country=person.get("country"),
        seniority=person.get("seniority"),
    )


class PersonaDiscoverResponse(BaseModel):
    status: str = "completed"
    suggestions: list[dict] = []
    source: str = "ai"  # "web_scrape", "apollo", or "ai"
    error: str | None = None


@router.post("/admin/cleanup-fake")
async def cleanup_fake_contacts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    dry_run: bool = Query(default=True, description="If true (default), only report - don't delete"),
) -> dict:
    """Admin: soft-delete AI-generated fake contacts.
    A contact is considered fake if:
      - source is 'ai_discovery' or 'ai', AND
      - it has not been verified via Apollo (enrichment_status != 'verified')
    Defaults to dry_run=true for safety.
    """
    from sqlalchemy import select, update, delete, or_
    from app.models.contact import Contact
    from app.models.message_draft import MessageDraft
    from app.models.campaign import CampaignContact

    if current_user.role != "admin":
        from app.exceptions import UnauthorizedError
        raise UnauthorizedError("Admin only")

    # Fake = source is ai_discovery/ai AND not verified
    stmt = select(Contact).where(
        Contact.is_deleted.is_(False),
        or_(Contact.source == "ai_discovery", Contact.source == "ai", Contact.source.is_(None)),
        Contact.enrichment_status != "verified",
    )
    result = await db.execute(stmt)
    fake_contacts = list(result.scalars().all())

    names = [f"{c.first_name} {c.last_name}" for c in fake_contacts]

    if not dry_run and fake_contacts:
        fake_ids = [c.id for c in fake_contacts]
        # Delete dependent records first
        await db.execute(delete(MessageDraft).where(MessageDraft.contact_id.in_(fake_ids)))
        await db.execute(delete(CampaignContact).where(CampaignContact.contact_id.in_(fake_ids)))
        # Soft-delete contacts
        await db.execute(update(Contact).where(Contact.id.in_(fake_ids)).values(is_deleted=True))
        await db.commit()

    # Count remaining active contacts
    total_stmt = select(Contact).where(Contact.is_deleted.is_(False))
    total_result = await db.execute(total_stmt)
    total_remaining = len(list(total_result.scalars().all()))

    return {
        "fake_found": len(fake_contacts),
        "deleted": len(fake_contacts) if not dry_run else 0,
        "would_delete": len(fake_contacts) if dry_run else 0,
        "remaining_after": total_remaining,
        "deleted_names": names,
        "dry_run": dry_run,
    }


@router.get("/admin/test-team-scrape")
async def test_team_scrape(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    company_name: str = Query(...),
    domain: str | None = Query(default=None),
) -> dict:
    """Admin: trace through team page discovery to debug."""
    if current_user.role != "admin":
        from app.exceptions import UnauthorizedError
        raise UnauthorizedError("Admin only")

    from app.services.team_page_scraper import (
        _probe_team_pages,
        search_via_serpapi,
        find_team_page_urls,
        fetch_page_text,
    )

    result = {
        "company_name": company_name,
        "domain": domain,
        "step1_url_probe": [],
        "step2_serpapi": [],
        "step3_combined": [],
        "step4_fetched_pages": [],
    }

    try:
        result["step1_url_probe"] = await _probe_team_pages(company_name, domain, max_results=5)
    except Exception as e:
        result["step1_error"] = str(e)

    try:
        result["step2_serpapi"] = await search_via_serpapi(company_name, domain, max_results=5)
    except Exception as e:
        result["step2_error"] = str(e)

    try:
        urls = await find_team_page_urls(company_name, domain, max_results=3)
        result["step3_combined"] = urls

        for u in urls[:2]:
            text = await fetch_page_text(u)
            result["step4_fetched_pages"].append({
                "url": u,
                "text_length": len(text),
                "text_preview": text[:300],
            })
    except Exception as e:
        result["step3_error"] = str(e)

    return result


@router.get("/admin/integration-status")
async def integration_status(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Admin: report which third-party integrations are configured."""
    from app.config import settings
    if current_user.role != "admin":
        from app.exceptions import UnauthorizedError
        raise UnauthorizedError("Admin only")
    def _mask(v: str) -> str:
        if not v: return ""
        return f"{v[:6]}...{v[-4:]} (len={len(v)})"
    return {
        "apollo_configured": bool(settings.APOLLO_API_KEY),
        "apollo_key_preview": _mask(settings.APOLLO_API_KEY),
        "serpapi_configured": bool(settings.SERPAPI_KEY),
        "serpapi_key_preview": _mask(settings.SERPAPI_KEY),
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "claude_configured": bool(settings.CLAUDE_API_KEY),
        "openai_configured": bool(settings.OPENAI_API_KEY),
    }


@router.post(
    "/company/{company_id}/discover-personas",
    response_model=PersonaDiscoverResponse,
)
async def discover_personas(
    company_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    method: str = Query(default="auto", description="'auto' (Web→AI), 'web' (scrape team page only), or 'ai' (LLM guess only). Apollo is NOT used here - use POST /contacts/{id}/verify-apollo per contact."),
) -> PersonaDiscoverResponse:
    """Discover contacts at a company.

    Methods (NONE consume Apollo credits - those are user-triggered only):
    1. web - Probe common URL paths (/leadership, /team, /about) on company's
             website. Scrape with AI extraction. FREE - real people only.
    2. ai  - AI guesses based on company knowledge (least reliable, free)

    'auto' tries Web first (free, real data), falls back to AI if no team page found.

    Apollo is NEVER used here. Apollo verification is a per-contact action
    triggered by the user via POST /contacts/{id}/verify-apollo (1 credit each).
    """
    import logging
    from app.services.company_service import get_company
    from app.config import settings

    logger = logging.getLogger(__name__)

    try:
        company = await get_company(db, company_id)

        # === METHOD 2: Web scraping team page (probes common URL paths) ===
        if (method in ("web", "auto")) and company.domain:
            try:
                from app.services.team_page_scraper import discover_team_via_web_scraping
                from app.agents.llm.router import LLMRouter

                llm_router = LLMRouter()
                web_contacts = await discover_team_via_web_scraping(
                    company_name=company.name,
                    domain=company.domain,
                    llm_router=llm_router,
                )
                if web_contacts:
                    suggestions = [
                        {
                            "first_name": c.get("first_name", ""),
                            "last_name": c.get("last_name", ""),
                            "job_title": c.get("job_title", ""),
                            "email": c.get("email"),
                            "phone": c.get("phone"),
                            "linkedin_url": c.get("linkedin_url"),
                            "confidence_score": c.get("confidence_score", 0.85),
                            "source": "web_scrape",
                            "source_url": c.get("source_url"),
                            "reasoning": f"Found on company team page: {c.get('source_url', '')}",
                        }
                        for c in web_contacts
                    ]
                    return PersonaDiscoverResponse(
                        status="completed",
                        suggestions=suggestions,
                        source="web_scrape",
                    )
                else:
                    logger.info("Web scraping found no contacts for %s", company.name)
            except Exception as web_err:
                logger.warning("Web scraping failed for %s: %s", company.name, str(web_err))
            if method == "web":
                return PersonaDiscoverResponse(
                    status="failed",
                    error="No team page found on the company website",
                )

        # NOTE: Apollo is intentionally NOT called here.
        # Apollo verification is per-contact and triggered by the user only
        # via POST /contacts/{id}/verify-apollo (1 credit per click).

        # === METHOD 3: AI persona discovery (least reliable - may invent) ===
        from app.agents.llm.router import LLMRouter
        from app.agents.persona_agent import PersonaAgent

        llm_router = LLMRouter()
        agent = PersonaAgent(llm_router=llm_router, db_session=db)

        result = await agent.execute({
            "company_name": company.name,
            "industry": company.industry,
            "employee_count": company.employee_count,
            "geography": company.geography,
            "domain": company.domain,
            "user_id": current_user.sub,
        })

        if not result.success:
            return PersonaDiscoverResponse(
                status="failed",
                error=result.error or "Failed to discover personas",
            )

        return PersonaDiscoverResponse(
            status="completed",
            suggestions=result.data.get("personas", []),
            source="ai",
        )
    except Exception as e:
        logger.error("Persona discovery failed for company %s: %s", company_id, str(e))
        return PersonaDiscoverResponse(
            status="failed",
            error=str(e),
        )

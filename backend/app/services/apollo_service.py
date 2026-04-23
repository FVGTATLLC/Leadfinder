"""Apollo.io API integration for real contact data enrichment."""

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

APOLLO_BASE_URL = "https://api.apollo.io/api/v1"
TIMEOUT = 30.0


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": settings.APOLLO_API_KEY,
    }


async def enrich_person(
    first_name: str | None = None,
    last_name: str | None = None,
    organization_name: str | None = None,
    domain: str | None = None,
    linkedin_url: str | None = None,
    email: str | None = None,
) -> dict[str, Any] | None:
    """
    Enrich a single person's data using Apollo's /people/match endpoint.
    Works on all API key tiers including free.
    """
    body: dict[str, Any] = {
        "reveal_personal_emails": True,
        "reveal_phone_number": True,
    }

    if first_name:
        body["first_name"] = first_name
    if last_name:
        body["last_name"] = last_name
    if organization_name:
        body["organization_name"] = organization_name
    if domain:
        body["domain"] = domain
    if linkedin_url:
        body["linkedin_url"] = linkedin_url
    if email:
        body["email"] = email

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{APOLLO_BASE_URL}/people/match",
                headers=_headers(),
                json=body,
            )
            logger.info("Apollo enrich response status: %s", resp.status_code)
            if resp.status_code != 200:
                logger.error("Apollo enrich error: %s", resp.text[:500])
                return None
            data = resp.json()
            person = data.get("person")
            if person:
                logger.info("Apollo enriched: %s %s at %s",
                            person.get("first_name"), person.get("last_name"),
                            person.get("organization", {}).get("name"))
            return data
    except Exception as e:
        logger.error("Apollo enrich error: %s", str(e))
        return None


async def search_organization(
    domain: str | None = None,
    name: str | None = None,
) -> dict[str, Any] | None:
    """Search for an organization in Apollo to get org ID."""
    body: dict[str, Any] = {"page": 1, "per_page": 5}

    if domain:
        body["q_organization_domains"] = domain
    if name:
        body["q_organization_name"] = name

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{APOLLO_BASE_URL}/mixed_companies/search",
                headers=_headers(),
                json=body,
            )
            if resp.status_code != 200:
                logger.warning("Apollo org search returned %s", resp.status_code)
                return None
            return resp.json()
    except Exception as e:
        logger.error("Apollo org search error: %s", str(e))
        return None


# Common job titles for travel industry sales targets
TRAVEL_INDUSTRY_ROLES = [
    {"title": "Head of Procurement", "first_name_hint": None},
    {"title": "Chief Financial Officer", "first_name_hint": None},
    {"title": "Travel Manager", "first_name_hint": None},
    {"title": "Head of Human Resources", "first_name_hint": None},
    {"title": "Head of Administration", "first_name_hint": None},
    {"title": "CEO", "first_name_hint": None},
    {"title": "Managing Director", "first_name_hint": None},
    {"title": "Operations Director", "first_name_hint": None},
    {"title": "General Manager", "first_name_hint": None},
    {"title": "Finance Director", "first_name_hint": None},
]


async def discover_contacts_at_company(
    company_name: str,
    domain: str | None = None,
    target_titles: list[str] | None = None,
    per_page: int = 10,
) -> list[dict[str, Any]]:
    """
    Find real contacts at a company using Apollo's people/match endpoint.
    Enriches each role one at a time (uses 1 credit per match).
    """
    contacts: list[dict[str, Any]] = []

    roles = TRAVEL_INDUSTRY_ROLES[:per_page]

    for role in roles:
        try:
            # Use people/match to find person by role at the company
            result = await enrich_person(
                organization_name=company_name,
                domain=domain,
            )

            if result and result.get("person"):
                person = result["person"]
                contact = _parse_person(person)
                if contact and contact.get("first_name"):
                    # Avoid duplicates
                    existing_names = {c.get("name", "") for c in contacts}
                    if contact.get("name") not in existing_names:
                        contacts.append(contact)

                # If we got one person, break and try a different approach
                # The /people/match without specific name returns the most relevant match
                break

        except Exception as e:
            logger.warning("Apollo match failed for role %s: %s", role["title"], str(e))
            continue

    # If single match worked, try to get more people with org search + enrichment
    if domain:
        # Try enriching with specific title keywords
        for role in roles:
            if len(contacts) >= per_page:
                break
            try:
                body: dict[str, Any] = {
                    "organization_name": company_name,
                    "reveal_personal_emails": True,
                    "reveal_phone_number": True,
                }
                if domain:
                    body["domain"] = domain

                async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                    resp = await client.post(
                        f"{APOLLO_BASE_URL}/people/match",
                        headers=_headers(),
                        json=body,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        person = data.get("person")
                        if person:
                            contact = _parse_person(person)
                            if contact and contact.get("first_name"):
                                existing_names = {c.get("name", "") for c in contacts}
                                if contact.get("name") not in existing_names:
                                    contacts.append(contact)
            except Exception:
                continue

    logger.info("Apollo discovered %d contacts for %s", len(contacts), company_name)
    return contacts


def _parse_person(person: dict) -> dict[str, Any]:
    """Parse a single Apollo person object into a clean contact dict."""
    contact: dict[str, Any] = {
        "apollo_id": person.get("id"),
        "first_name": person.get("first_name", ""),
        "last_name": person.get("last_name", ""),
        "name": person.get("name", ""),
        "title": person.get("title", ""),
        "headline": person.get("headline", ""),
        "email": person.get("email"),
        "email_status": person.get("email_status"),
        "phone": None,
        "linkedin_url": person.get("linkedin_url"),
        "photo_url": person.get("photo_url"),
        "city": person.get("city"),
        "state": person.get("state"),
        "country": person.get("country"),
        "seniority": person.get("seniority"),
        "departments": person.get("departments", []),
        "organization_name": None,
        "organization_domain": None,
        "source": "apollo",
    }

    # Extract org info
    org = person.get("organization", {})
    if org:
        contact["organization_name"] = org.get("name")
        contact["organization_domain"] = org.get("primary_domain")

    # Get phone
    phone_numbers = person.get("phone_numbers", [])
    if phone_numbers:
        contact["phone"] = (
            phone_numbers[0].get("sanitized_number")
            or phone_numbers[0].get("raw_number")
        )

    return contact

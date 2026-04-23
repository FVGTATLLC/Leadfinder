"""
Team page scraper service.

Two-stage discovery:
1. SerpAPI (if configured) - searches Google for the company's team/leadership page
2. Direct URL probing - tries common /leadership /team /about paths on the domain

Falls back gracefully: SerpAPI → URL probe → empty.
Then scrapes the found page and uses AI to extract real names + titles.
"""
import asyncio
import logging
import re
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


TIMEOUT = 12.0
MAX_PAGE_SIZE = 200_000  # 200KB max per page (HTML can be huge)
SERPAPI_URL = "https://serpapi.com/search"


# Common URL paths where companies publish their team/leadership info.
# Ordered by likelihood of finding executive contacts.
TEAM_PAGE_PATHS = [
    "/leadership",
    "/our-leadership",
    "/management",
    "/management-team",
    "/executive-team",
    "/executives",
    "/board",
    "/board-of-directors",
    "/our-team",
    "/team",
    "/people",
    "/about/leadership",
    "/about/management",
    "/about/team",
    "/about/people",
    "/about-us/leadership",
    "/about-us/management",
    "/about-us/team",
    "/about-us/our-team",
    "/about",
    "/about-us",
    "/who-we-are",
    "/company/leadership",
    "/company/management",
    "/company/team",
    "/investor-relations/board-of-directors",
    "/investors/leadership",
    "/contact",
    "/contact-us",
]


# Keywords in URL that suggest a team page
TEAM_URL_KEYWORDS = [
    "leadership", "management", "team", "executives", "board",
    "about", "people", "directors", "staff", "officers", "founders",
    "who-we-are", "our-people",
]


async def search_via_serpapi(
    company_name: str,
    domain: str | None = None,
    max_results: int = 5,
) -> list[str]:
    """
    Use SerpAPI to find Google results for the company's team page.

    Cost-optimised: makes only ONE search query per company.
    The single query is crafted to maximise hit rate by combining
    site filter (when domain available) with team-page keywords.
    """
    if not settings.SERPAPI_KEY:
        return []

    # Single optimised query per company (1 credit per company instead of 3)
    # Always include "Nigeria" to filter for Nigerian operations of multinationals
    if domain:
        clean = domain.lower().replace("https://", "").replace("http://", "").rstrip("/").split("/")[0]
        query = (
            f'site:{clean} Nigeria '
            f'(leadership OR management OR "our team" OR executives OR "board of directors")'
        )
    else:
        query = (
            f'"{company_name}" Nigeria '
            f'(leadership OR management OR "our team" OR executives) -jobs -careers'
        )

    found_urls: list[str] = []
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            resp = await client.get(
                SERPAPI_URL,
                params={
                    "api_key": settings.SERPAPI_KEY,
                    "engine": "google",
                    "q": query,
                    "num": 10,
                    "gl": "ng",  # Geo-localise to Nigeria
                    "hl": "en",
                },
            )
            if resp.status_code != 200:
                logger.warning("SerpAPI returned %s: %s", resp.status_code, resp.text[:200])
                return []

            data = resp.json()
            results = data.get("organic_results", [])
            for r in results:
                link = r.get("link")
                if not link or link in seen:
                    continue
                seen.add(link)
                lower = link.lower()
                # Prioritise team-page-looking URLs first
                if any(kw in lower for kw in TEAM_URL_KEYWORDS):
                    found_urls.insert(0, link)
                else:
                    found_urls.append(link)
        except Exception as e:
            logger.error("SerpAPI query failed: %s", str(e))
            return []

    logger.info(
        "SerpAPI found %d candidate team URLs for %s (1 credit used)",
        len(found_urls), company_name,
    )
    return found_urls[:max_results]


async def find_team_page_urls(
    company_name: str,
    domain: str | None = None,
    max_results: int = 5,
) -> list[str]:
    """
    Find the company's team/leadership page URL.

    Cost-optimised strategy:
    1. FREE: Direct URL probing on the company's domain
    2. PAID: SerpAPI Google search ONLY if URL probing didn't find a strong
       team-page match (covers the harder cases and PDFs/external pages)

    Returns URLs that look like team pages.
    """
    # FREE: Try direct URL probing first
    probed_urls = await _probe_team_pages(company_name, domain, max_results=max_results)

    # Check if probed results contain a strong team-page URL
    has_strong_match = any(
        any(strong in url.lower() for strong in [
            "leadership", "management", "executives", "board", "directors",
            "our-team", "/team", "our-people", "officers",
        ])
        for url in probed_urls
    )

    if has_strong_match:
        logger.info(
            "Found strong team page via free URL probe for %s (no SerpAPI credit)",
            company_name,
        )
        return probed_urls[:max_results]

    # PAID FALLBACK: Use SerpAPI for better matches
    serp_urls: list[str] = []
    if settings.SERPAPI_KEY:
        logger.info(
            "Probe found no strong matches for %s, using SerpAPI (1 credit)",
            company_name,
        )
        serp_urls = await search_via_serpapi(company_name, domain, max_results=max_results)

    # Combine: SerpAPI first (better quality), then probe results as backup
    combined: list[str] = []
    seen: set[str] = set()
    for url in serp_urls + probed_urls:
        if url in seen:
            continue
        # Skip PDFs and other binary file types - we can't extract text from them well
        lower = url.lower()
        if lower.endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx")):
            continue
        seen.add(url)
        combined.append(url)
        if len(combined) >= max_results:
            break

    if not combined:
        logger.info("No team pages found for %s after all attempts", company_name)
    return combined


async def _probe_team_pages(
    company_name: str,
    domain: str | None = None,
    max_results: int = 5,
) -> list[str]:
    """Probe common team-page URL paths on the company's own website (FREE)."""
    if not domain:
        logger.info("No domain for %s - skipping URL probe", company_name)
        return []

    # Clean the domain
    clean = domain.lower().strip()
    clean = clean.replace("https://", "").replace("http://", "").rstrip("/")
    # Remove any path suffix like "/ng"
    clean = clean.split("/")[0]

    if not clean or "." not in clean:
        return []

    found_urls: list[str] = []
    sem = asyncio.Semaphore(8)  # 8 concurrent probes

    # Use a real browser User-Agent to avoid being blocked
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        verify=False,
        follow_redirects=True,
        headers={
            "User-Agent": browser_ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        async def _probe(path: str) -> str | None:
            async with sem:
                for scheme in ("https", "http"):
                    url = f"{scheme}://{clean}{path}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code == 200 and resp.text:
                            # Reject if redirected to homepage or unrelated page
                            final_url = str(resp.url).lower()
                            if path == "/about" or path == "/about-us":
                                pass  # accept these
                            elif path.lower().split("/")[-1] not in final_url:
                                # Was redirected away from the requested page
                                continue
                            # Sanity check - page should have multiple team-related keywords
                            lower_text = resp.text.lower()
                            keyword_hits = sum(1 for kw in [
                                "ceo", "cfo", "cto", "coo", "director", "executive",
                                "leadership", "management", "founder", "president",
                                "chairman", "managing director", "head of",
                            ] if kw in lower_text)
                            # Need at least 2 keyword matches to be a real team page
                            if keyword_hits >= 2:
                                logger.info(
                                    "Team page found: %s (%d keyword hits)",
                                    url, keyword_hits,
                                )
                                return url
                    except Exception as e:
                        logger.debug("Probe failed for %s: %s", url, str(e))
                        continue
                return None

        results = await asyncio.gather(
            *[_probe(p) for p in TEAM_PAGE_PATHS],
            return_exceptions=True,
        )

        for r in results:
            if isinstance(r, str):
                found_urls.append(r)
                if len(found_urls) >= max_results:
                    break

    if not found_urls:
        logger.info("URL probe found 0 team pages for %s (%s)", company_name, clean)

    logger.info(
        "Found %d team page URLs for %s (%s)",
        len(found_urls), company_name, clean,
    )
    return found_urls[:max_results]


async def fetch_page_text(url: str) -> str:
    """Fetch a page and return the text content (HTML stripped)."""
    browser_ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            verify=False,
            follow_redirects=True,
            headers={
                "User-Agent": browser_ua,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        ) as client:
            resp = await client.get(url)
            logger.info("Fetched %s -> status %s, size %d", url, resp.status_code, len(resp.text))
            if resp.status_code != 200:
                return ""
            html = resp.text[:MAX_PAGE_SIZE]
            # Strip HTML tags (basic regex - not perfect but enough for AI)
            text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text[:30_000]  # Limit to 30k chars for AI
    except Exception as e:
        logger.warning("Failed to fetch %s: %s", url, str(e))
        return ""


async def discover_team_via_web_scraping(
    company_name: str,
    domain: str | None,
    llm_router,
) -> list[dict[str, Any]]:
    """
    Find a company's team page via Google, scrape it, and use AI to extract contacts.

    Returns a list of contacts with name, title, email, linkedin if available.
    """
    # Step 1: Find candidate team page URLs
    urls = await find_team_page_urls(company_name, domain, max_results=3)
    if not urls:
        logger.info("No team pages found for %s", company_name)
        return []

    logger.info("Found %d candidate team pages for %s", len(urls), company_name)

    # Step 2: Fetch each page and combine text
    page_texts: list[str] = []
    for url in urls:
        text = await fetch_page_text(url)
        if text:
            page_texts.append(f"--- Page: {url} ---\n{text}")

    if not page_texts:
        return []

    combined_text = "\n\n".join(page_texts)[:50_000]

    # Step 3: Use AI to extract structured contacts from the page text
    schema = {
        "type": "object",
        "properties": {
            "contacts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "first_name": {"type": "string"},
                        "last_name": {"type": "string"},
                        "job_title": {"type": "string"},
                        "email": {"type": "string"},
                        "linkedin_url": {"type": "string"},
                        "phone": {"type": "string"},
                        "source_url": {"type": "string"},
                    },
                    "required": ["first_name", "last_name", "job_title"],
                },
                "maxItems": 20,
            },
        },
        "required": ["contacts"],
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a precise data extraction assistant for a NIGERIAN sales platform. "
                "Given the text content of a company's team/leadership/about page, extract "
                "REAL people with their actual names, job titles, and contact info that "
                "appears VERBATIM in the page text.\n\n"
                "CRITICAL RULES:\n"
                "1. DO NOT invent names, titles, or contact details\n"
                "2. DO NOT include people only mentioned in passing (news quotes, customers, partners)\n"
                "3. PRIORITISE people based in Nigeria or working at Nigerian operations\n"
                "4. If the page is for a multinational's other country (e.g., KPMG Australia), "
                "   ONLY include people who are explicitly identified as Nigeria-based, "
                "   Nigeria-region leadership, or West Africa leadership. Skip everyone else.\n"
                "5. If unsure whether a person is Nigeria-relevant, exclude them rather than including\n"
                "6. Set source_url to the URL where you found this person"
            ),
        },
        {
            "role": "user",
            "content": (
                f"Company: {company_name}\n"
                f"Domain: {domain or 'unknown'}\n"
                f"Target market: Nigeria\n\n"
                f"Page content:\n{combined_text}\n\n"
                "Extract key team members / executives / directors mentioned in the "
                "page text who are RELEVANT TO THE NIGERIAN OPERATIONS of this company. "
                "Only include people whose name AND title appear explicitly in the text."
            ),
        },
    ]

    try:
        result = await llm_router.complete_structured(
            task_type="research",
            messages=messages,
            schema=schema,
        )
        contacts = result.get("contacts", [])

        # Normalise & validate
        validated = []
        for c in contacts:
            first = (c.get("first_name") or "").strip()
            last = (c.get("last_name") or "").strip()
            title = (c.get("job_title") or "").strip()
            if not first or not last or not title:
                continue

            email = (c.get("email") or "").strip() or None
            linkedin = (c.get("linkedin_url") or "").strip() or None
            if linkedin and not linkedin.startswith("http"):
                linkedin = f"https://{linkedin}" if "linkedin.com" in linkedin else None

            validated.append({
                "first_name": first,
                "last_name": last,
                "job_title": title,
                "email": email,
                "linkedin_url": linkedin,
                "phone": c.get("phone") or None,
                "source": "web_scrape",
                "source_url": c.get("source_url") or urls[0] if urls else None,
                "confidence_score": 0.85,  # Higher than AI invention, lower than Apollo verified
            })

        logger.info(
            "Web scraping found %d contacts for %s",
            len(validated), company_name,
        )
        return validated
    except Exception as e:
        logger.error("AI extraction failed for %s: %s", company_name, str(e))
        return []

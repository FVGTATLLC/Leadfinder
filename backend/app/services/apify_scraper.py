"""Apify Google Maps Scraper integration.

Runs the public Google Maps scraper actor (ID: nwua9Gu5YrADL7ZDj) via Apify's
run-sync-get-dataset-items endpoint and returns the resulting place records.
"""

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

APIFY_ACTOR_ID = "nwua9Gu5YrADL7ZDj"
APIFY_BASE_URL = "https://api.apify.com/v2"
TIMEOUT = 600.0


def extract_domain(website_url: str | None) -> str | None:
    """Pull a bare domain (no protocol, no path, no query) from a website URL."""
    if not website_url:
        return None
    cleaned = website_url.strip().lower()
    for prefix in ("https://", "http://"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :]
            break
    cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0]
    if cleaned.startswith("www."):
        cleaned = cleaned[4:]
    return cleaned or None


def map_place_to_company(place: dict[str, Any]) -> dict[str, Any]:
    """Convert an Apify Google Maps place dict into Company model kwargs."""
    website = place.get("website")
    country_code = place.get("countryCode")
    state = place.get("state")
    geography_parts = [p for p in (state, country_code) if p]
    return {
        "name": place.get("title") or "Unknown",
        "domain": extract_domain(website),
        "website": website,
        "industry": place.get("categoryName"),
        "city": place.get("city"),
        "country": country_code,
        "geography": ", ".join(geography_parts) if geography_parts else None,
        "source": "google_maps",
        "score_breakdown": {
            "place_id": place.get("placeId"),
            "phone": place.get("phone"),
            "total_score": place.get("totalScore"),
            "reviews_count": place.get("reviewsCount"),
            "address": place.get("address"),
            "categories": place.get("categories"),
            "location": place.get("location"),
        },
    }


async def scrape_google_maps(
    search_terms: list[str],
    location_query: str | None = None,
    max_per_search: int = 50,
    language: str = "en",
    category_filters: list[str] | None = None,
    country_code: str | None = None,
    city: str | None = None,
    state: str | None = None,
    skip_closed: bool = True,
    scrape_contacts: bool = False,
    scrape_place_detail_page: bool = False,
    place_minimum_stars: str = "",
    search_matching: str = "all",
    website_filter: str = "allPlaces",
) -> list[dict[str, Any]]:
    """Run the Apify Google Maps Scraper and return the scraped places.

    Raises httpx.HTTPStatusError on non-2xx responses. Callers should handle.
    """
    if not settings.APIFY_API_TOKEN:
        raise RuntimeError("APIFY_API_TOKEN is not configured")

    run_input: dict[str, Any] = {
        "searchStringsArray": search_terms,
        "maxCrawledPlacesPerSearch": max_per_search,
        "language": language,
        "searchMatching": search_matching,
        "placeMinimumStars": place_minimum_stars,
        "website": website_filter,
        "skipClosedPlaces": skip_closed,
        "scrapePlaceDetailPage": scrape_place_detail_page,
        "scrapeContacts": scrape_contacts,
        "categoryFilterWords": category_filters or [],
    }
    if location_query:
        run_input["locationQuery"] = location_query
    if country_code:
        run_input["countryCode"] = country_code
    if city:
        run_input["city"] = city
    if state:
        run_input["state"] = state

    url = (
        f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items"
        f"?token={settings.APIFY_API_TOKEN}"
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        logger.info(
            "Starting Apify Google Maps scrape: terms=%s location=%s max=%s",
            search_terms,
            location_query,
            max_per_search,
        )
        response = await client.post(url, json=run_input)
        response.raise_for_status()
        items = response.json()
        logger.info("Apify returned %d places", len(items))
        return items

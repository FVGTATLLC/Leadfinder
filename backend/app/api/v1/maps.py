"""Google Maps scraping endpoints (powered by Apify)."""

import logging
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.schemas.user import TokenPayload
from app.services.apify_scraper import scrape_google_maps

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/maps", tags=["maps"])


class ScrapeMapsRequest(BaseModel):
    search_terms: list[str] = Field(..., min_length=1)
    location_query: str | None = None
    max_per_search: int = Field(default=50, ge=1, le=500)
    language: str = "en"
    category_filters: list[str] | None = None
    country_code: str | None = None
    city: str | None = None
    state: str | None = None
    skip_closed: bool = True
    scrape_contacts: bool = False
    scrape_place_detail_page: bool = False


class ScrapeMapsResponse(BaseModel):
    count: int
    places: list[dict[str, Any]]


@router.post("/scrape", response_model=ScrapeMapsResponse)
async def scrape_maps(
    body: ScrapeMapsRequest,
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> ScrapeMapsResponse:
    """Run the Apify Google Maps scraper and return raw place results."""
    try:
        places = await scrape_google_maps(
            search_terms=body.search_terms,
            location_query=body.location_query,
            max_per_search=body.max_per_search,
            language=body.language,
            category_filters=body.category_filters,
            country_code=body.country_code,
            city=body.city,
            state=body.state,
            skip_closed=body.skip_closed,
            scrape_contacts=body.scrape_contacts,
            scrape_place_detail_page=body.scrape_place_detail_page,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        logger.exception("Apify request failed")
        raise HTTPException(
            status_code=502,
            detail=f"Apify scraper failed: {exc.response.status_code}",
        ) from exc
    except httpx.HTTPError as exc:
        logger.exception("Apify network error")
        raise HTTPException(status_code=504, detail="Apify scraper timed out") from exc

    return ScrapeMapsResponse(count=len(places), places=places)

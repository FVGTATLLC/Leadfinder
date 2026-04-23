"""Gmail OAuth integration API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.schemas.user import TokenPayload
from app.services import gmail_service

router = APIRouter(prefix="/gmail", tags=["gmail"])


@router.get("/connect")
async def connect_gmail(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Get the Google OAuth authorization URL to connect Gmail."""
    if not settings.GOOGLE_CLIENT_ID:
        return {"error": "Gmail integration not configured. Contact admin."}

    auth_url = gmail_service.get_authorization_url(current_user.sub)
    return {"authorization_url": auth_url}


@router.get("/callback")
async def gmail_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle the Google OAuth callback after user grants permission."""
    try:
        connection = await gmail_service.handle_oauth_callback(db, code, state)

        # Redirect back to frontend settings page with success
        # Use the production Vercel URL, fallback to first CORS origin
        frontend_url = "http://localhost:3000"
        origins = settings.CORS_ORIGINS.split(",")
        for origin in origins:
            o = origin.strip()
            if "vercel.app" in o or o.startswith("https://"):
                frontend_url = o
                break

        return RedirectResponse(
            url=f"{frontend_url}/dashboard/settings?gmail=connected&email={connection.gmail_address}"
        )
    except Exception as e:
        frontend_url = "http://localhost:3000"
        return RedirectResponse(
            url=f"{frontend_url}/dashboard/settings?gmail=error&message={str(e)}"
        )


@router.get("/status")
async def gmail_status(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Check if the current user has a connected Gmail account."""
    connection = await gmail_service.get_connection(db, current_user.sub)

    if connection:
        return {
            "connected": True,
            "gmail_address": connection.gmail_address,
            "connected_at": connection.connected_at.isoformat() if connection.connected_at else None,
            "is_active": connection.is_active,
        }
    return {
        "connected": False,
        "gmail_address": None,
        "connected_at": None,
        "is_active": False,
    }


@router.post("/disconnect")
async def disconnect_gmail(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Disconnect the user's Gmail account."""
    result = await gmail_service.disconnect(db, current_user.sub)
    if result:
        return {"status": "disconnected", "message": "Gmail account disconnected successfully."}
    return {"status": "not_found", "message": "No Gmail connection found."}


@router.post("/send-test")
async def send_test_email(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Send a test email to verify the Gmail connection."""
    result = await gmail_service.send_test_email(db, current_user.sub)
    return result

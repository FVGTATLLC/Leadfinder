"""Gmail OAuth integration — connect user Gmail accounts and send emails via Gmail API."""

import base64
import logging
import urllib.parse
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import NotFoundError, UnauthorizedError
from app.models.gmail_connection import GmailConnection

logger = logging.getLogger(__name__)

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def get_authorization_url(user_id: str) -> str:
    """Generate the Google OAuth authorization URL (without PKCE)."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GMAIL_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": user_id,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


async def handle_oauth_callback(
    db: AsyncSession, code: str, state: str
) -> GmailConnection:
    """Exchange the OAuth code for tokens and store the connection."""
    user_id = state

    # Exchange code for tokens using httpx (no PKCE)
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GMAIL_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

        if token_resp.status_code != 200:
            logger.error("Token exchange failed: %s", token_resp.text)
            raise UnauthorizedError(f"Token exchange failed: {token_resp.text}")

        token_data = token_resp.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 3600)

        # Get user's email address
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if userinfo_resp.status_code != 200:
            raise UnauthorizedError("Failed to get user info from Google")

        user_info = userinfo_resp.json()
        gmail_address = user_info.get("email", "")

    # Check if connection already exists for this user
    stmt = select(GmailConnection).where(
        GmailConnection.user_id == user_id,
        GmailConnection.is_deleted.is_(False),
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    token_expiry = datetime.fromtimestamp(
        now.timestamp() + expires_in, tz=timezone.utc
    )

    if existing:
        existing.gmail_address = gmail_address
        existing.access_token = access_token
        existing.refresh_token = refresh_token or existing.refresh_token
        existing.token_expires_at = token_expiry
        existing.scopes = " ".join(GMAIL_SCOPES)
        existing.is_active = True
        existing.connected_at = now
        await db.flush()
        await db.refresh(existing)
        logger.info("Updated Gmail connection for user %s: %s", user_id, gmail_address)
        return existing
    else:
        connection = GmailConnection(
            user_id=user_id,
            gmail_address=gmail_address,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expiry,
            scopes=" ".join(GMAIL_SCOPES),
            is_active=True,
            connected_at=now,
        )
        db.add(connection)
        await db.flush()
        await db.refresh(connection)
        logger.info("Created Gmail connection for user %s: %s", user_id, gmail_address)
        return connection


async def get_connection(db: AsyncSession, user_id: str) -> GmailConnection | None:
    """Get a user's Gmail connection."""
    stmt = select(GmailConnection).where(
        GmailConnection.user_id == user_id,
        GmailConnection.is_deleted.is_(False),
        GmailConnection.is_active.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _refresh_access_token(connection: GmailConnection) -> str:
    """Refresh the access token using the refresh token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": connection.refresh_token,
                "grant_type": "refresh_token",
            },
        )

        if resp.status_code != 200:
            logger.error("Token refresh failed: %s", resp.text)
            raise UnauthorizedError("Gmail token refresh failed. Please reconnect.")

        data = resp.json()
        return data["access_token"]


def _get_credentials(connection: GmailConnection) -> Credentials:
    """Build Google credentials from stored connection and refresh if needed."""
    creds = Credentials(
        token=connection.access_token,
        refresh_token=connection.refresh_token,
        token_uri=GOOGLE_TOKEN_URL,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=connection.scopes.split(" ") if connection.scopes else GMAIL_SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleAuthRequest())

    return creds


async def send_email(
    db: AsyncSession,
    user_id: str,
    to: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> dict:
    """Send an email via the user's connected Gmail account."""
    connection = await get_connection(db, user_id)
    if not connection:
        raise NotFoundError("No Gmail connection found. Please connect your Gmail first.")

    try:
        # Refresh token if needed
        now = datetime.now(timezone.utc)
        if connection.token_expires_at and now >= connection.token_expires_at:
            new_token = await _refresh_access_token(connection)
            connection.access_token = new_token
            connection.token_expires_at = datetime.fromtimestamp(
                now.timestamp() + 3600, tz=timezone.utc
            )
            await db.flush()

        creds = _get_credentials(connection)

        # Build MIME message
        msg = MIMEMultipart("alternative")
        msg["To"] = to
        msg["From"] = connection.gmail_address
        msg["Subject"] = subject

        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        service = build("gmail", "v1", credentials=creds)
        sent = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": raw_message})
            .execute()
        )

        logger.info(
            "Email sent via Gmail for user %s to %s (message_id: %s)",
            user_id, to, sent.get("id"),
        )

        return {
            "success": True,
            "message_id": sent.get("id"),
            "from": connection.gmail_address,
            "to": to,
            "error": None,
        }

    except Exception as e:
        logger.error("Gmail send failed for user %s: %s", user_id, str(e))
        return {
            "success": False,
            "message_id": None,
            "from": connection.gmail_address if connection else None,
            "to": to,
            "error": str(e),
        }


async def disconnect(db: AsyncSession, user_id: str) -> bool:
    """Disconnect a user's Gmail account."""
    connection = await get_connection(db, user_id)
    if not connection:
        return False

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": connection.access_token},
            )
    except Exception as e:
        logger.warning("Token revocation failed: %s", str(e))

    connection.is_active = False
    connection.is_deleted = True
    await db.flush()

    logger.info("Disconnected Gmail for user %s", user_id)
    return True


async def send_test_email(db: AsyncSession, user_id: str) -> dict:
    """Send a test email to verify the Gmail connection works."""
    connection = await get_connection(db, user_id)
    if not connection:
        raise NotFoundError("No Gmail connection found.")

    return await send_email(
        db=db,
        user_id=user_id,
        to=connection.gmail_address,
        subject="SalesPilot — Gmail Connection Test",
        body_html=(
            "<div style='font-family: Arial, sans-serif; padding: 20px;'>"
            "<h2 style='color: #4F46E5;'>Gmail Connection Successful!</h2>"
            "<p>Your Gmail account <strong>{}</strong> is now connected to SalesPilot.</p>"
            "<p>You can now send emails to clients directly from the platform.</p>"
            "<hr style='border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;'>"
            "<p style='color: #6B7280; font-size: 12px;'>This is an automated test from SalesPilot.</p>"
            "</div>"
        ).format(connection.gmail_address),
    )

import logging
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)

_email_sender_instance: "EmailSender | None" = None


class EmailSender:
    """Async SMTP email sender for outbound messages."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        use_tls: bool = True,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_tls = use_tls

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: str,
        from_name: str = "SalesPilot",
        reply_to: str | None = None,
    ) -> dict:
        """
        Send a plain text email.

        Returns:
            dict with keys: success (bool), message_id (str), error (str|None)
        """
        message_id = f"<{uuid.uuid4().hex}@clubconcierge.com>"

        msg = MIMEText(format_plain_email(body), "plain", "utf-8")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Message-ID"] = message_id
        if reply_to:
            msg["Reply-To"] = reply_to

        try:
            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                start_tls=self.use_tls,
            )

            logger.info(
                "Email sent successfully to %s, message_id=%s",
                to_email,
                message_id,
            )

            return {
                "success": True,
                "message_id": message_id,
                "error": None,
            }

        except Exception as e:
            logger.error(
                "Failed to send email to %s: %s",
                to_email,
                str(e),
            )
            return {
                "success": False,
                "message_id": message_id,
                "error": str(e),
            }

    async def send_html_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str,
        from_email: str,
        from_name: str = "SalesPilot",
        reply_to: str | None = None,
    ) -> dict:
        """
        Send an HTML email with plain text fallback.

        Returns:
            dict with keys: success (bool), message_id (str), error (str|None)
        """
        message_id = f"<{uuid.uuid4().hex}@clubconcierge.com>"

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Message-ID"] = message_id
        if reply_to:
            msg["Reply-To"] = reply_to

        text_part = MIMEText(format_plain_email(text_body), "plain", "utf-8")
        html_part = MIMEText(html_body, "html", "utf-8")

        msg.attach(text_part)
        msg.attach(html_part)

        try:
            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                start_tls=self.use_tls,
            )

            logger.info(
                "HTML email sent successfully to %s, message_id=%s",
                to_email,
                message_id,
            )

            return {
                "success": True,
                "message_id": message_id,
                "error": None,
            }

        except Exception as e:
            logger.error(
                "Failed to send HTML email to %s: %s",
                to_email,
                str(e),
            )
            return {
                "success": False,
                "message_id": message_id,
                "error": str(e),
            }


def get_email_sender() -> EmailSender:
    """Get or create a singleton EmailSender instance from app settings."""
    global _email_sender_instance
    if _email_sender_instance is None:
        _email_sender_instance = EmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
        )
    return _email_sender_instance


def format_plain_email(body: str) -> str:
    """Ensure proper line breaks in plain text email body."""
    # Normalize line endings
    text = body.replace("\r\n", "\n").replace("\r", "\n")
    # Ensure paragraphs are separated by double newlines
    lines = text.split("\n")
    formatted_lines: list[str] = []
    for line in lines:
        formatted_lines.append(line.rstrip())
    return "\n".join(formatted_lines)


def format_html_email(body: str, contact_name: str) -> str:
    """Wrap plain text body in a simple, professional HTML email template."""
    # Convert plain text line breaks to HTML
    html_body = body.replace("\n\n", "</p><p>").replace("\n", "<br>")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; background-color: #f4f4f4;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 30px 40px;">
                            <p>{html_body}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
                            <p style="margin: 0;">SalesPilot | Corporate Travel &amp; MICE Solutions</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

from __future__ import annotations

import re
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app.config.settings import (
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TIMEOUT_SECONDS,
    SMTP_USERNAME,
    SMTP_USE_TLS,
)


_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailNotConfiguredError(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class InvoiceEmail:
    recipient: str
    subject: str
    body: str
    attachment_name: str
    attachment_bytes: bytes


class EmailProvider(Protocol):
    def send_invoice(self, message: InvoiceEmail) -> None: ...


def normalize_recipient(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if len(normalized) > 254 or not _EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("The customer does not have a valid email address.")
    return normalized


class SmtpEmailProvider:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        from_email: str,
        username: str | None,
        password: str | None,
        use_tls: bool,
        timeout_seconds: float,
    ) -> None:
        self.host = host
        self.port = port
        self.from_email = normalize_recipient(from_email)
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.timeout_seconds = timeout_seconds

    def send_invoice(self, message: InvoiceEmail) -> None:
        email = EmailMessage()
        email["From"] = self.from_email
        email["To"] = normalize_recipient(message.recipient)
        email["Subject"] = message.subject.replace("\r", " ").replace("\n", " ")[:200]
        email.set_content(message.body)
        email.add_attachment(
            message.attachment_bytes,
            maintype="application",
            subtype="pdf",
            filename=message.attachment_name,
        )

        try:
            with smtplib.SMTP(
                self.host,
                self.port,
                timeout=self.timeout_seconds,
            ) as server:
                if self.use_tls:
                    server.starttls()
                if self.username:
                    server.login(self.username, self.password or "")
                server.send_message(email)
        except Exception as error:
            raise EmailDeliveryError("The email provider could not deliver the invoice.") from error


def get_email_provider() -> EmailProvider:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise EmailNotConfiguredError(
            "Invoice email delivery is not configured on the server."
        )
    if bool(SMTP_USERNAME) != bool(SMTP_PASSWORD):
        raise EmailNotConfiguredError(
            "Invoice email authentication is not configured correctly."
        )
    return SmtpEmailProvider(
        host=SMTP_HOST,
        port=SMTP_PORT,
        from_email=SMTP_FROM_EMAIL,
        username=SMTP_USERNAME,
        password=SMTP_PASSWORD,
        use_tls=SMTP_USE_TLS,
        timeout_seconds=SMTP_TIMEOUT_SECONDS,
    )

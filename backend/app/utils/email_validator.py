import re

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
)


def validate_email_format(email: str) -> bool:
    """Validate an email address against a standard regex pattern."""
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def generate_email_patterns(
    first_name: str,
    last_name: str,
    domain: str,
) -> list[str]:
    """
    Generate common corporate email patterns from a name and domain.

    Returns a list of candidate email addresses ordered by likelihood.
    """
    if not first_name or not last_name or not domain:
        return []

    first = first_name.strip().lower()
    last = last_name.strip().lower()
    d = domain.strip().lower()

    # Remove any protocol prefix from domain
    if d.startswith("http://"):
        d = d[7:]
    if d.startswith("https://"):
        d = d[8:]
    d = d.rstrip("/")

    patterns = [
        f"{first}.{last}@{d}",
        f"{first[0]}{last}@{d}",
        f"{first}_{last}@{d}",
        f"{first}{last[0]}@{d}",
        f"{first}@{d}",
        f"{last}@{d}",
        f"{first[0]}.{last}@{d}",
    ]

    return patterns


def normalize_email(email: str) -> str:
    """Normalize an email address: lowercase and strip whitespace."""
    if not email:
        return ""
    return email.strip().lower()


def extract_domain_from_email(email: str) -> str:
    """Extract the domain portion from an email address."""
    if not email or "@" not in email:
        return ""
    return email.strip().lower().split("@", 1)[1]

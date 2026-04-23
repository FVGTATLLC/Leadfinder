import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

from fastapi import Depends, HTTPException, Request


@dataclass
class TokenBucket:
    """Token bucket for rate limiting."""

    rate: float  # tokens per second
    burst: int  # maximum tokens (bucket capacity)
    tokens: float = 0.0
    last_refill: float = field(default_factory=time.monotonic)

    def __post_init__(self) -> None:
        self.tokens = float(self.burst)

    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(
            self.burst,
            self.tokens + elapsed * self.rate,
        )
        self.last_refill = now

    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens from the bucket.

        Returns True if tokens were consumed, False if rate limit exceeded.
        """
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    @property
    def retry_after(self) -> float:
        """Seconds until at least 1 token is available."""
        self._refill()
        if self.tokens >= 1:
            return 0.0
        deficit = 1.0 - self.tokens
        return deficit / self.rate


class RateLimiter:
    """
    In-memory rate limiter using token bucket algorithm.

    Supports per-key rate limiting (e.g., per-user, per-endpoint).
    For production, replace the in-memory dict with Redis-backed storage.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, TokenBucket] = {}

    def _get_bucket(self, key: str, rate: float, burst: int) -> TokenBucket:
        """Get or create a token bucket for the given key."""
        if key not in self._buckets:
            self._buckets[key] = TokenBucket(rate=rate, burst=burst)
        return self._buckets[key]

    def check(self, key: str, rate: float, burst: int) -> bool:
        """
        Check if a request is allowed under the rate limit.

        Args:
            key: Unique identifier (e.g., user_id, IP address).
            rate: Tokens per second.
            burst: Maximum burst size.

        Returns:
            True if the request is allowed.
        """
        bucket = self._get_bucket(key, rate, burst)
        return bucket.consume()

    def get_retry_after(self, key: str, rate: float, burst: int) -> float:
        """Get seconds until the next request will be allowed."""
        bucket = self._get_bucket(key, rate, burst)
        return bucket.retry_after

    def cleanup(self, max_age_seconds: float = 3600.0) -> int:
        """
        Remove stale buckets that haven't been accessed recently.

        Returns the number of buckets removed.
        """
        now = time.monotonic()
        stale_keys = [
            key
            for key, bucket in self._buckets.items()
            if (now - bucket.last_refill) > max_age_seconds
        ]
        for key in stale_keys:
            del self._buckets[key]
        return len(stale_keys)


# Global rate limiter instance
_rate_limiter = RateLimiter()


def rate_limit_dependency(
    key_prefix: str,
    rate: float = 10.0,
    burst: int = 20,
) -> Callable:
    """
    FastAPI dependency factory for rate limiting.

    Args:
        key_prefix: Prefix for the rate limit key (e.g., endpoint name).
        rate: Requests per second allowed.
        burst: Maximum burst size.

    Returns:
        A FastAPI dependency that enforces rate limiting.

    Usage:
        @router.get("/endpoint", dependencies=[Depends(rate_limit_dependency("my_endpoint", rate=5, burst=10))])
        async def my_endpoint(): ...
    """

    async def _rate_limit_check(request: Request) -> None:
        # Build a key from prefix + client identifier
        client_ip = request.client.host if request.client else "unknown"

        # Try to use authenticated user ID if available
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            # Use a hash of the token as the key for authenticated users
            token_part = auth_header[7:20]  # Use first 13 chars of token
            client_key = f"{key_prefix}:{token_part}"
        else:
            client_key = f"{key_prefix}:{client_ip}"

        if not _rate_limiter.check(client_key, rate, burst):
            retry_after = _rate_limiter.get_retry_after(client_key, rate, burst)
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later.",
                headers={"Retry-After": str(int(retry_after) + 1)},
            )

    return _rate_limit_check

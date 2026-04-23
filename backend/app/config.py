from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "SalesPilot"
    ALLOWED_EMAIL_DOMAIN: str = "clubconcierge.com"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/salespilot"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Cloud SQL support — set these to connect via Cloud SQL Auth Proxy / Unix socket
    CLOUD_SQL_CONNECTION_NAME: str = ""  # e.g. "project:region:instance"
    DB_USER: str = ""
    DB_PASS: str = ""
    DB_NAME: str = "salespilot"

    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    CLAUDE_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    APOLLO_API_KEY: str = ""
    GOOGLE_SEARCH_API_KEY: str = ""
    GOOGLE_SEARCH_ENGINE_ID: str = ""
    SERPAPI_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GMAIL_REDIRECT_URI: str = ""
    GCS_BUCKET: str = ""

    SMTP_HOST: str = "smtp.zoho.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def effective_database_url(self) -> str:
        """Build the database URL, preferring Cloud SQL socket when available."""
        if self.CLOUD_SQL_CONNECTION_NAME and self.DB_USER:
            # Cloud Run provides a Unix socket at /cloudsql/<connection-name>
            socket_path = f"/cloudsql/{self.CLOUD_SQL_CONNECTION_NAME}"
            return (
                f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASS}"
                f"@/{self.DB_NAME}?host={socket_path}"
            )
        return self.DATABASE_URL


settings = Settings()

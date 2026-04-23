import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class GCSClient:
    """Google Cloud Storage client for file uploads."""

    def __init__(
        self,
        bucket_name: str,
        credentials_path: str | None = None,
    ) -> None:
        self.bucket_name = bucket_name
        self.credentials_path = credentials_path
        self._client = None
        self._bucket = None

    def _get_client(self):
        if self._client is None:
            from google.cloud import storage

            if self.credentials_path:
                self._client = storage.Client.from_service_account_json(
                    self.credentials_path
                )
            else:
                self._client = storage.Client()
        return self._client

    def _get_bucket(self):
        if self._bucket is None:
            client = self._get_client()
            self._bucket = client.bucket(self.bucket_name)
        return self._bucket

    def upload_string(
        self,
        content: str,
        filename: str,
        content_type: str = "text/csv",
    ) -> str:
        """Upload a string to GCS and return the public URL."""
        bucket = self._get_bucket()
        blob = bucket.blob(filename)
        blob.upload_from_string(content, content_type=content_type)
        return self.generate_signed_url(filename)

    def upload_file(self, file_path: str, filename: str) -> str:
        """Upload a local file to GCS and return the URL."""
        bucket = self._get_bucket()
        blob = bucket.blob(filename)
        blob.upload_from_filename(file_path)
        return self.generate_signed_url(filename)

    def generate_signed_url(
        self,
        filename: str,
        expiration_hours: int = 24,
    ) -> str:
        """Generate a signed URL for downloading a file."""
        bucket = self._get_bucket()
        blob = bucket.blob(filename)
        url = blob.generate_signed_url(
            expiration=timedelta(hours=expiration_hours),
            method="GET",
        )
        return url

    def delete_file(self, filename: str) -> bool:
        """Delete a file from GCS."""
        try:
            bucket = self._get_bucket()
            blob = bucket.blob(filename)
            blob.delete()
            return True
        except Exception as e:
            logger.error("Failed to delete GCS file %s: %s", filename, str(e))
            return False


class LocalStorageClient:
    """Local filesystem fallback when GCS is not configured."""

    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = Path(base_dir or os.path.join(os.getcwd(), "local_exports"))
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def upload_string(
        self,
        content: str,
        filename: str,
        content_type: str = "text/csv",
    ) -> str:
        """Save content to local file and return file:// URL."""
        file_path = self.base_dir / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return f"file://{file_path.resolve()}"

    def upload_file(self, file_path: str, filename: str) -> str:
        """Copy a local file and return file:// URL."""
        import shutil

        dest_path = self.base_dir / filename
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, dest_path)
        return f"file://{dest_path.resolve()}"

    def generate_signed_url(
        self,
        filename: str,
        expiration_hours: int = 24,
    ) -> str:
        """Return a file:// URL for local storage."""
        file_path = self.base_dir / filename
        return f"file://{file_path.resolve()}"

    def delete_file(self, filename: str) -> bool:
        """Delete a local file."""
        try:
            file_path = self.base_dir / filename
            if file_path.exists():
                file_path.unlink()
            return True
        except Exception as e:
            logger.error("Failed to delete local file %s: %s", filename, str(e))
            return False


def get_storage_client() -> GCSClient | LocalStorageClient:
    """Get the appropriate storage client based on configuration."""
    if settings.GCS_BUCKET:
        try:
            return GCSClient(bucket_name=settings.GCS_BUCKET)
        except Exception as e:
            logger.warning(
                "Failed to initialize GCS client, falling back to local storage: %s",
                str(e),
            )
            return LocalStorageClient()
    else:
        logger.info("GCS_BUCKET not configured, using local file storage")
        return LocalStorageClient()


def get_gcs_client() -> GCSClient | LocalStorageClient:
    """Alias for get_storage_client for backward compatibility."""
    return get_storage_client()

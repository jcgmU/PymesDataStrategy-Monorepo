"""MinIO/S3 storage service implementation using boto3.

All boto3 calls are synchronous (blocking). To avoid blocking the asyncio
event loop we run each call in a thread pool via ``asyncio.get_event_loop().
run_in_executor(None, ...)``.  This is functionally identical to the previous
implementation but safe for use in async contexts.
"""

import asyncio
from functools import partial
from io import BytesIO
from typing import Any, BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from src.domain.ports.services.storage_service import StorageService
from src.infrastructure.config.settings import Settings


class MinioStorageService(StorageService):
    """MinIO/S3 storage implementation using boto3."""

    def __init__(self, settings: Settings) -> None:
        """Initialize MinIO client.

        Args:
            settings: Application settings with MinIO configuration.
        """
        self._settings = settings

        protocol = "https" if settings.minio_use_ssl else "http"
        endpoint_url = f"{protocol}://{settings.minio_endpoint}:{settings.minio_port}"

        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.minio_access_key or "minioadmin",
            aws_secret_access_key=settings.minio_secret_key or "minioadmin123",
            # region must match the API's signing region (us-east-1) or SigV4
            # signatures mismatch and Tigris/S3 returns AccessDenied on GetObject.
            region_name=settings.minio_region,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},  # Required for MinIO
            ),
        )

        self._bucket_datasets = settings.minio_bucket_datasets
        self._bucket_results = settings.minio_bucket_results
        self._bucket_temp = settings.minio_bucket_temp

    # ------------------------------------------------------------------
    # Internal helper
    # ------------------------------------------------------------------

    async def _run(self, func: Any, *args: Any, **kwargs: Any) -> Any:
        """Run a synchronous boto3 call in the default thread-pool executor.

        This prevents the synchronous network I/O from blocking the asyncio
        event loop.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    # ------------------------------------------------------------------
    # Bucket accessors
    # ------------------------------------------------------------------

    @property
    def datasets_bucket(self) -> str:
        """Get datasets bucket name."""
        return self._bucket_datasets

    @property
    def results_bucket(self) -> str:
        """Get results bucket name."""
        return self._bucket_results

    @property
    def temp_bucket(self) -> str:
        """Get temp bucket name."""
        return self._bucket_temp

    # ------------------------------------------------------------------
    # StorageService interface
    # ------------------------------------------------------------------

    async def upload_file(
        self,
        bucket: str,
        key: str,
        data: BinaryIO,
        content_type: str | None = None,
    ) -> str:
        """Upload a file to storage.

        Returns the storage path (s3://bucket/key).
        """
        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type

        if hasattr(data, "read"):
            content = data.read()
            if isinstance(content, str):
                content = content.encode("utf-8")
        else:
            content = data  # type: ignore[assignment]

        await self._run(
            self._client.put_object,
            Bucket=bucket,
            Key=key,
            Body=content,
            **extra_args,
        )

        return f"s3://{bucket}/{key}"

    async def download_file(self, bucket: str, key: str) -> bytes:
        """Download a file from storage.

        Raises:
            FileNotFoundError: If the object doesn't exist.
        """
        try:
            response = await self._run(
                self._client.get_object, Bucket=bucket, Key=key
            )
            # Body.read() is also synchronous — run it in executor too
            body = response["Body"]
            return await asyncio.get_event_loop().run_in_executor(None, body.read)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
                raise FileNotFoundError(f"Object not found: {bucket}/{key}") from e
            raise

    async def download_file_stream(self, bucket: str, key: str) -> BytesIO:
        """Download a file as a BytesIO stream."""
        content = await self.download_file(bucket, key)
        return BytesIO(content)

    async def delete_file(self, bucket: str, key: str) -> None:
        """Delete a file from storage."""
        await self._run(self._client.delete_object, Bucket=bucket, Key=key)

    async def file_exists(self, bucket: str, key: str) -> bool:
        """Check if a file exists in storage."""
        try:
            await self._run(self._client.head_object, Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    async def get_presigned_url(
        self,
        bucket: str,
        key: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned URL for file access.

        Note: generate_presigned_url is a local computation (no network call)
        so we do not need to offload it to the executor.
        """
        url: str = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url

    async def get_object_metadata(
        self,
        bucket: str,
        key: str,
    ) -> dict[str, str]:
        """Get object metadata.

        Raises:
            FileNotFoundError: If the object doesn't exist.
        """
        try:
            response = await self._run(
                self._client.head_object, Bucket=bucket, Key=key
            )
            return {
                "content_type": response.get("ContentType", ""),
                "content_length": str(response.get("ContentLength", 0)),
                "last_modified": str(response.get("LastModified", "")),
                "etag": response.get("ETag", "").strip('"'),
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                raise FileNotFoundError(f"Object not found: {bucket}/{key}") from e
            raise

    async def list_objects(
        self,
        bucket: str,
        prefix: str = "",
        max_keys: int = 1000,
    ) -> list[dict[str, str]]:
        """List objects in a bucket with optional prefix filter."""
        response = await self._run(
            self._client.list_objects_v2,
            Bucket=bucket,
            Prefix=prefix,
            MaxKeys=max_keys,
        )

        return [
            {
                "key": obj["Key"],
                "size": str(obj["Size"]),
                "last_modified": str(obj["LastModified"]),
                "etag": obj["ETag"].strip('"'),
            }
            for obj in response.get("Contents", [])
        ]

    async def ensure_bucket_exists(self, bucket: str) -> None:
        """Ensure a bucket exists, creating it if necessary."""
        try:
            await self._run(self._client.head_bucket, Bucket=bucket)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchBucket"):
                await self._run(self._client.create_bucket, Bucket=bucket)
            else:
                raise

    async def health_check(self) -> bool:
        """Check if MinIO is accessible."""
        try:
            await self._run(self._client.list_buckets)
            return True
        except Exception:
            return False

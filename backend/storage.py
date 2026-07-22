"""
Backblaze B2 storage service.

When B2 credentials are set (USE_B2=True), files are uploaded to B2 and their
public CDN URL is returned. Otherwise falls through to local disk storage.

Usage:
    from backend.storage import save_upload
    url, path = await save_upload(file_bytes, filename, content_type)
"""

import os
import time
import hashlib
import boto3
from botocore.client import Config
from backend.config import (
    B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME,
    B2_BUCKET_ID, B2_ENDPOINT, USE_B2
)

# ── Local upload dirs ──────────────────────────────────────────────────────────
LOCAL_UPLOAD_BASE = "uploads"
os.makedirs(f"{LOCAL_UPLOAD_BASE}/questions", exist_ok=True)
os.makedirs(f"{LOCAL_UPLOAD_BASE}/pdfs", exist_ok=True)
os.makedirs(f"{LOCAL_UPLOAD_BASE}/snapshots", exist_ok=True)


def _b2_client():
    """Return a boto3 S3 client pointed at the B2 S3-compatible endpoint."""
    endpoint = B2_ENDPOINT or f"https://s3.us-west-004.backblazeb2.com"
    if not endpoint.startswith("http"):
        endpoint = "https://" + endpoint
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APPLICATION_KEY,
        config=Config(signature_version="s3v4"),
    )


def save_upload_sync(file_bytes: bytes, original_filename: str, content_type: str,
                     subfolder: str = "questions") -> tuple[str, str]:
    """
    Save an uploaded file.
    Returns (public_url_or_local_path, storage_path).

    For B2: returns (cdn_url, b2_key)
    For local: returns (/static/uploads/... url, relative_path)
    """
    ext = os.path.splitext(original_filename)[1].lower()
    # deterministic but collision-resistant filename
    digest = hashlib.md5(file_bytes).hexdigest()[:10]
    fname  = f"{int(time.time())}_{digest}{ext}"

    if USE_B2:
        try:
            key = f"{subfolder}/{fname}"
            client = _b2_client()
            client.put_object(
                Bucket=B2_BUCKET_NAME,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            # B2 public URL (bucket must have public access enabled)
            url = f"https://{B2_BUCKET_NAME}.{B2_ENDPOINT.lstrip('https://').lstrip('http://')}/{key}"
            return url, key
        except Exception as e:
            # B2 failed — fall through to local disk
            print(f"[B2 upload failed, falling back to local]: {e}")

    # Local disk fallback
    local_dir  = os.path.join(LOCAL_UPLOAD_BASE, subfolder)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, fname)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    rel_path   = os.path.join(subfolder, fname)          # e.g. "questions/abc.jpg"
    static_url = f"/static/uploads/{rel_path}"           # served by FastAPI
    return static_url, rel_path


def delete_upload(storage_path: str):
    """Delete a file from B2 or local disk."""
    if USE_B2:
        try:
            client = _b2_client()
            client.delete_object(Bucket=B2_BUCKET_NAME, Key=storage_path)
            return
        except Exception as e:
            print(f"[B2 delete failed]: {e}")
    # Local fallback
    local = os.path.join(LOCAL_UPLOAD_BASE, storage_path)
    if os.path.exists(local):
        os.remove(local)
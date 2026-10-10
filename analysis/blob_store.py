"""Blob store — Cloudflare R2 (S3-compatible) for every large asset.

All chart PNGs, telemetry blobs, race replays and circuit geometry used to live in
Supabase Storage. That bucket hit ~10 GB against a 1 GB free-tier cap (and its object
metadata alone was 134 MB of the Postgres quota), so blobs now go to R2: 10 GB free and
zero egress. One bucket, with the old Supabase bucket names kept as key prefixes so every
`storage_path` already stored in Postgres stays valid — a public URL is simply
`{BLOB_PUBLIC_BASE}/{prefix}/{storage_path}`.

Env (all required for uploads; --no-upload paths never touch this module):
  R2_ACCOUNT_ID          Cloudflare account id
  R2_ACCESS_KEY_ID       R2 API token key
  R2_SECRET_ACCESS_KEY   R2 API token secret
  R2_BUCKET              bucket name            (default: f1datastop)
  BLOB_PUBLIC_BASE       public host for reads  e.g. https://cdn.f1datastop.com
"""
import functools
import gzip
import os

PREFIXES = ("charts", "telemetry", "replays", "circuits", "data")
IMMUTABLE = "public, max-age=31536000, immutable"


def _need(name, default=None):
    v = os.environ.get(name, default)
    if not v:
        raise SystemExit(
            f"blob_store: missing env {name}. Uploads need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
            "R2_SECRET_ACCESS_KEY, R2_BUCKET and BLOB_PUBLIC_BASE (see analysis/blob_store.py)."
        )
    return v


def bucket():
    return _need("R2_BUCKET", "f1datastop")


def public_base():
    return _need("BLOB_PUBLIC_BASE").rstrip("/")


@functools.lru_cache(maxsize=1)
def client():
    import boto3
    from botocore.config import Config
    acct = _need("R2_ACCOUNT_ID")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{acct}.r2.cloudflarestorage.com",
        aws_access_key_id=_need("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_need("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4",
                      retries={"max_attempts": 6, "mode": "standard"}),
    )


def public_url(prefix, path):
    assert prefix in PREFIXES, prefix
    return f"{public_base()}/{prefix}/{path}"


def put(prefix, path, data, content_type, *, gzip_body=False, cache_control=IMMUTABLE):
    """Upload bytes and return the public URL.

    gzip_body=True stores the object gzip-compressed with Content-Encoding: gzip so a
    browser fetch() decodes transparently — telemetry/replay JSON shrinks 3-5x."""
    assert prefix in PREFIXES, prefix
    body = gzip.compress(data, 6) if gzip_body else data
    extra = {"ContentType": content_type, "CacheControl": cache_control}
    if gzip_body:
        extra["ContentEncoding"] = "gzip"
    client().put_object(Bucket=bucket(), Key=f"{prefix}/{path}", Body=body, **extra)
    return public_url(prefix, path)


def exists(prefix, path):
    from botocore.exceptions import ClientError
    try:
        client().head_object(Bucket=bucket(), Key=f"{prefix}/{path}")
        return True
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def delete(prefix, paths):
    """Delete many keys (batched 1000/call). Returns count requested."""
    keys = [{"Key": f"{prefix}/{p}"} for p in paths]
    for i in range(0, len(keys), 1000):
        client().delete_objects(Bucket=bucket(), Delete={"Objects": keys[i:i + 1000], "Quiet": True})
    return len(keys)


def list_keys(prefix, sub=""):
    """Yield storage_paths (without the prefix) under prefix/sub."""
    pfx = f"{prefix}/{sub}" if sub else f"{prefix}/"
    paginator = client().get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket(), Prefix=pfx):
        for obj in page.get("Contents", []):
            yield obj["Key"][len(prefix) + 1:], obj["Size"]

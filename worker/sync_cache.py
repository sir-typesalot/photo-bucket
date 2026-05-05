import os
import json
import io
import logging
import boto3
from botocore.exceptions import ClientError
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY = os.environ["R2_ACCESS_KEY"]
R2_SECRET_KEY = os.environ["R2_SECRET_KEY"]
R2_BUCKET     = os.environ.get("R2_BUCKET", "photo-bucket")

PUBLIC_PREFIX = "public/"
CACHE_PREFIX  = "cache/"
MANIFEST_KEY  = "manifest.json"
RESIZE_FACTOR = 0.4
JPEG_QUALITY  = 85
# ─────────────────────────────────────────────────────────────────────────────

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    region_name="auto",
)

def fetch_manifest() -> list[str]:
    try:
        res = s3.get_object(Bucket=R2_BUCKET, Key=MANIFEST_KEY)
        return json.loads(res["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            log.info("No manifest found, starting fresh.")
            return []
        raise

def save_manifest(manifest: list[str]) -> None:
    s3.put_object(
        Bucket=R2_BUCKET,
        Key=MANIFEST_KEY,
        Body=json.dumps(manifest, indent=2).encode(),
        ContentType="application/json",
    )
    log.info(f"Manifest updated with {len(manifest)} entries.")

def list_public_images() -> list[str]:
    keys = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix=PUBLIC_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                keys.append(key)
    return keys

def public_to_cache_key(public_key: str) -> str:
    """Convert public/foo.jpg -> cache/foo.jpg"""
    return CACHE_PREFIX + public_key[len(PUBLIC_PREFIX):]

def resize_and_upload(public_key: str, cache_key: str) -> None:
    log.info(f"Processing: {public_key} -> {cache_key}")

    res = s3.get_object(Bucket=R2_BUCKET, Key=public_key)
    img = Image.open(io.BytesIO(res["Body"].read()))

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    new_w = int(img.width * RESIZE_FACTOR)
    new_h = int(img.height * RESIZE_FACTOR)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    buf.seek(0)

    s3.put_object(
        Bucket=R2_BUCKET,
        Key=cache_key,
        Body=buf,
        ContentType="image/jpeg",
    )
    log.info(f"Uploaded: {cache_key} ({new_w}x{new_h})")

def remove_cache_file(cache_key: str) -> None:
    s3.delete_object(Bucket=R2_BUCKET, Key=cache_key)
    log.info(f"Deleted: {cache_key}")


def main():
    manifest = fetch_manifest()
    manifest_set = set(manifest)

    public_keys = list_public_images()
    log.info(f"Found {len(public_keys)} images in {PUBLIC_PREFIX}")

    # Add new images
    new_entries = []
    for public_key in public_keys:
        cache_key = public_to_cache_key(public_key)
        if cache_key not in manifest_set:
            try:
                resize_and_upload(public_key, cache_key)
                new_entries.append(cache_key)
            except Exception as e:
                log.error(f"Failed to process {public_key}: {e}")

    # Clean up images that have been removed from public/
    expected_cache_keys = set(public_to_cache_key(k) for k in public_keys)
    removed_entries = []
    for image in list(manifest_set):
        if image not in expected_cache_keys:
            log.info(f"Found file in manifest that was removed from public/: {image}")
            try:
                remove_cache_file(image)
                manifest.remove(image)
                removed_entries.append(image)
            except Exception as e:
                log.error(f"Failed to remove file: {image} - {e}")

    if new_entries:
        manifest.extend(new_entries)
        log.info(f"Added {len(new_entries)} new image(s) to manifest.")

    if new_entries or removed_entries:
        save_manifest(manifest)
    else:
        log.info("No changes found.")

if __name__ == "__main__":
    main()

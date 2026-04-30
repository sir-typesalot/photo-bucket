import * as photon from "@cf-wasm/photon";

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const PUBLIC_PREFIX = "public/";
const CACHE_PREFIX  = "cache/";
const MANIFEST_KEY  = "manifest.json";
const RESIZE_FACTOR = 0.4;
// ─────────────────────────────────────────────────────────────────────────────

async function fetchManifest(bucket) {
  const obj = await bucket.get(MANIFEST_KEY);
  if (!obj) return [];
  return JSON.parse(await obj.text());
}

async function saveManifest(bucket, manifest) {
  await bucket.put(MANIFEST_KEY, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function listPublicImages(bucket) {
  const keys = [];
  let cursor;
  do {
    const res = await bucket.list({ prefix: PUBLIC_PREFIX, cursor });
    for (const obj of res.objects) {
      if (/\.(jpe?g|png|webp)$/i.test(obj.key)) keys.push(obj.key);
    }
    cursor = res.truncated ? res.cursor : null;
  } while (cursor);
  return keys;
}

function publicToCacheKey(publicKey) {
  return CACHE_PREFIX + publicKey.slice(PUBLIC_PREFIX.length);
}

async function resizeAndUpload(bucket, publicKey, cacheKey) {
  const obj = await bucket.get(publicKey);
  if (!obj) throw new Error(`Object not found: ${publicKey}`);

  const inputBytes = new Uint8Array(await obj.arrayBuffer());
  const img = photon.PhotonImage.new_from_byteslice(inputBytes);
  const w = Math.round(img.get_width() * RESIZE_FACTOR);
  const h = Math.round(img.get_height() * RESIZE_FACTOR);
  photon.resize(img, w, h, photon.SamplingFilter.Lanczos3);
  const outputBytes = img.get_bytes_jpeg(85);
  img.free();

  await bucket.put(cacheKey, outputBytes, {
    httpMetadata: { contentType: "image/jpeg" },
  });
}

export default {
  async scheduled(event, env, ctx) {
    const manifest    = await fetchManifest(env.BUCKET);
    const manifestSet = new Set(manifest);
    const publicKeys  = await listPublicImages(env.BUCKET);

    const newEntries = [];
    for (const publicKey of publicKeys) {
      const cacheKey = publicToCacheKey(publicKey);
      if (manifestSet.has(cacheKey)) continue;
      try {
        await resizeAndUpload(env.BUCKET, publicKey, cacheKey);
        newEntries.push(cacheKey);
        console.log(`Processed: ${publicKey} -> ${cacheKey}`);
      } catch (err) {
        console.error(`Failed to process ${publicKey}:`, err);
      }
    }

    if (newEntries.length) {
      manifest.push(...newEntries);
      await saveManifest(env.BUCKET, manifest);
      console.log(`Added ${newEntries.length} new image(s) to manifest.`);
    } else {
      console.log("No new images found.");
    }
  },
};

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const R2_BASE_URL = "https://YOUR_BUCKET.YOUR_ACCOUNT.r2.cloudflarestorage.com";
const CACHE_PREFIX = "cache/";
// ─────────────────────────────────────────────────────────────────────────────

const grid    = document.getElementById("grid");
const status  = document.getElementById("status");
const errMsg  = document.getElementById("error-msg");

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

// Strip the cache prefix to get the original file key
function originalKey(cacheKey) {
  return cacheKey.startsWith(CACHE_PREFIX)
    ? cacheKey.slice(CACHE_PREFIX.length)
    : cacheKey;
}

function showSkeletons(n = 12) {
  for (let i = 0; i < n; i++) {
    const card = document.createElement("div");
    card.className = "card skeleton";
    card.innerHTML = `
      <div class="card-thumb"></div>
      <div class="card-info">
        <div class="card-name">loading</div>
        <div class="card-meta">loading</div>
      </div>`;
    grid.appendChild(card);
  }
}

function clearSkeletons() {
  grid.querySelectorAll(".skeleton").forEach(el => el.remove());
}

function renderCard({ key, size, lastModified }) {
  const thumbUrl    = `${R2_BASE_URL}/${key}`;
  const originalUrl = `${R2_BASE_URL}/${originalKey(key)}`;
  const filename    = key.split("/").pop();

  const a = document.createElement("a");
  a.className = "card";
  a.href      = originalUrl;
  a.target    = "_blank";
  a.rel       = "noopener noreferrer";
  a.title     = filename;

  const img = document.createElement("img");
  img.className = "card-thumb";
  img.src       = thumbUrl;
  img.alt       = filename;
  img.loading   = "lazy";
  img.decoding  = "async";
  img.addEventListener("error", () => a.remove());

  const info = document.createElement("div");
  info.className = "card-info";
  info.innerHTML = `
    <div class="card-name">${filename}</div>
    <div class="card-meta">${formatSize(size)} · ${formatDate(lastModified)}</div>`;

  a.appendChild(img);
  a.appendChild(info);
  grid.appendChild(a);
}

async function fetchFiles() {
  const url = `${R2_BASE_URL}/?list-type=2&prefix=${encodeURIComponent(CACHE_PREFIX)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bucket list failed: ${res.status}`);

  const xml = new DOMParser().parseFromString(await res.text(), "application/xml");

  return [...xml.querySelectorAll("Contents")].map(node => ({
    key:          node.querySelector("Key").textContent,
    size:         parseInt(node.querySelector("Size").textContent, 10),
    lastModified: node.querySelector("LastModified").textContent,
  }));
}

async function init() {
  showSkeletons();
  try {
    const files = await fetchFiles();
    clearSkeletons();

    if (!files.length) throw new Error("No files found.");

    files.forEach(renderCard);
    status.textContent = `${files.length} files`;
  } catch (err) {
    clearSkeletons();
    errMsg.style.display = "block";
    status.textContent = "Error";
    console.error(err);
  }
}

init();

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const R2_BASE_URL = "https://pub-d54c467e80a6423abad4626c231a696d.r2.dev";
const CACHE_PREFIX = "cache/";
const PUBLIC_PREFIX = "public/";
// ─────────────────────────────────────────────────────────────────────────────

const grid    = document.getElementById("grid");
const status  = document.getElementById("status");
const errMsg  = document.getElementById("error-msg");

// Swap the cache prefix for the public prefix to get the original file key
function originalKey(cacheKey) {
  return cacheKey.startsWith(CACHE_PREFIX)
    ? PUBLIC_PREFIX + cacheKey.slice(CACHE_PREFIX.length)
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

function renderCard({ key }) {
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
  info.innerHTML = `<div class="card-name">${filename}</div>`;

  a.appendChild(img);
  a.appendChild(info);
  grid.appendChild(a);
}

async function fetchFiles() {
  const res = await fetch(`${R2_BASE_URL}/manifest.json`);
  if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status}`);

  const keys = await res.json();
  return keys.map(key => ({ key }));
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

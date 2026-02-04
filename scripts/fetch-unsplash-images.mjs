import fs from "fs";
import path from "path";
import axios from "axios";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/fetch-unsplash-images.mjs <client_slug>");
  process.exit(1);
}

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error("Missing UNSPLASH_ACCESS_KEY env var.");
  process.exit(1);
}

const root = process.cwd();
const clientDir = path.join(root, "clients", slug);
const businessPath = path.join(clientDir, "business.json");
const clientAssetsDir = path.join(clientDir, "assets", "images");

if (!fs.existsSync(businessPath)) {
  console.error(`Missing ${businessPath} (run merge-json first)`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(businessPath, "utf-8"));

if (!fs.existsSync(clientAssetsDir)) {
  fs.mkdirSync(clientAssetsDir, { recursive: true });
}

const brandSlug =
  data.brand?.slug ||
  (data.brand?.name || "brand")
    .toLowerCase()
    .replace(/'/g, "")        // MATCH Hero.astro
    .replace(/[^a-z0-9]/g, "-"); // MATCH Hero.astro

async function searchUnsplashPhoto(query) {
  const res = await axios.get("https://api.unsplash.com/search/photos", {
    params: { query, orientation: "landscape", per_page: 1 },
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
    timeout: 30000
  });
  const first = res.data?.results?.[0];
  // Use "regular" as you did; could switch to "full" if you want higher res.
  return first?.urls?.regular || null;
}

function buildFallbackQueries(query, industryFallback) {
  const q = (query || "").trim();
  const fallbacks = [];

  if (q) fallbacks.push(q);

  if (q) {
    fallbacks.push(
      q
        .replace(/\b(close-up|closeup|professional|premium|luxury|high-end|highend)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    fallbacks.push(tokens.slice(0, 4).join(" "));
    fallbacks.push(tokens.slice(0, 2).join(" "));
  }

  if (industryFallback) fallbacks.push(industryFallback);

  // last safe defaults
  fallbacks.push("modern service business");
  fallbacks.push("professional team at work");
  fallbacks.push("clean minimal office");

  return [...new Set(fallbacks)].filter(Boolean);
}

async function fetchUnsplashImage(query, filename) {
  const filePath = path.join(clientAssetsDir, filename);

  if (fs.existsSync(filePath)) {
    console.log(`- Skipping ${filename} (already exists)`);
    return;
  }

  const fallbacks = buildFallbackQueries(query, data?.intelligence?.industry);

  let downloadUrl = null;
  for (const q of fallbacks) {
    console.log(`🔍 Unsplash: "${q}"`);
    try {
      downloadUrl = await searchUnsplashPhoto(q);
      if (downloadUrl) break;
    } catch (e) {
      const msg = e?.response?.data?.errors?.[0] || e.message;
      console.log(`  ↳ search error: ${msg}`);
    }
  }

  if (!downloadUrl) {
    console.log(`! No results for: ${query}`);
    return;
  }

  const res = await axios({ url: downloadUrl, method: "GET", responseType: "arraybuffer", timeout: 60000 });
  fs.writeFileSync(filePath, Buffer.from(res.data));
  console.log(`✅ Saved ${filename}`);
}

function ensureGallerySlots(dataObj, desiredCount = 6) {
  // If gallery is missing/empty, generate placeholder items so preview looks premium.
  if (!dataObj.gallery) {
    dataObj.gallery = { enabled: true, items: [] };
  }

  const g = dataObj.gallery;
  const isLegacyArray = Array.isArray(g);
  if (isLegacyArray) return dataObj; // leave legacy alone

  if (!Array.isArray(g.items)) g.items = [];
  while (g.items.length < desiredCount) {
    g.items.push({
      alt: "Project photo",
      image_search_query: ""
    });
  }

  if (typeof g.computed_count !== "number") g.computed_count = desiredCount;
  if (!g.image_source) g.image_source = {};
  return dataObj;
}

async function run() {
  console.log(`🚀 Image Factory (CI): ${brandSlug}`);

  // Ensure gallery has some slots for premium preview (optional but recommended)
  ensureGallerySlots(data, 6);
  fs.writeFileSync(businessPath, JSON.stringify(data, null, 2));

  // HERO
  const heroQuery = data?.hero?.image?.image_search_query || data?.hero?.image?.alt || data?.intelligence?.industry;
  if (heroQuery) {
    await fetchUnsplashImage(heroQuery, `${brandSlug}-hero.jpg`);
  } else {
    console.log("⚠️ No hero query/alt/industry found.");
  }

  // GALLERY
  const galleryObj = data.gallery;
  const isLegacyArray = Array.isArray(galleryObj);
  const galleryEnabled = isLegacyArray ? true : galleryObj?.enabled !== false;
  const galleryItems = isLegacyArray ? galleryObj : (galleryObj?.items || []);

  if (galleryEnabled && galleryItems.length > 0) {
    const desiredCount =
      (!isLegacyArray && typeof galleryObj?.computed_count === "number")
        ? galleryObj.computed_count
        : galleryItems.length;

    const itemsToProcess = galleryItems.slice(0, Math.max(0, desiredCount));
    const globalQuery =
      (!isLegacyArray && galleryObj?.image_source?.image_search_query)
        ? galleryObj.image_source.image_search_query
        : "";

    for (const [index, item] of itemsToProcess.entries()) {
      const q =
        item?.image_search_query ||
        globalQuery ||
        item?.alt ||
        data?.intelligence?.industry ||
        "professional services";

      await fetchUnsplashImage(q, `${brandSlug}-project-${index}.jpg`);
    }
  } else {
    console.log("ℹ️ Gallery disabled or empty.");
  }

  console.log("✅ Images ready under:", clientAssetsDir);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

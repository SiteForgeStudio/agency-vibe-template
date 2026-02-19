// scripts/fetch-unsplash-images.mjs
import fs from "node:fs";
import path from "node:path";

const UNSPLASH_API = "https://api.unsplash.com";

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash error ${res.status}: ${text}`);
  }
  return JSON.parse(await res.text());
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

const clientSlug = process.argv[2];
if (!clientSlug) {
  console.error("Usage: node scripts/fetch-unsplash-images.mjs <client_slug>");
  process.exit(1);
}

const accessKey = process.env.UNSPLASH_ACCESS_KEY;
if (!accessKey) {
  console.error("Missing UNSPLASH_ACCESS_KEY in environment.");
  process.exit(1);
}

const headers = { Authorization: `Client-ID ${accessKey}` };
const clientDir = path.join("clients", clientSlug);
const clientData = readJson(path.join(clientDir, "business.json"));
const outDir = path.join(clientDir, "assets", "images");
ensureDir(outDir);

const brandSlug = clientData?.brand?.slug || clientSlug;

async function run() {
  // --- 1. FETCH HERO IMAGE ---
  const heroQuery = clientData.hero?.image?.image_search_query || "professional background";
  console.log(`🔍 Fetching Hero Image: ${heroQuery}`);
  const heroSearch = await fetchJson(`${UNSPLASH_API}/search/photos?query=${encodeURIComponent(heroQuery)}&orientation=landscape&per_page=1`, headers);
  if (heroSearch.results?.[0]) {
    await downloadToFile(heroSearch.results[0].urls.regular, path.join(outDir, `${brandSlug}-hero.jpg`));
  }

  // --- 2. FETCH GALLERY IMAGES ---
  const gallery = clientData.gallery || {};
  const isEnabled = clientData.strategy?.show_gallery !== false;
  
  if (isEnabled) {
    const items = Array.isArray(gallery.items) ? gallery.items : [];
    // Use computed_count from AI or fallback to 6
    const count = gallery.computed_count || (items.length > 0 ? items.length : 6);
    const globalQuery = gallery.image_source?.image_search_query || clientData.intelligence?.industry || "service";
    
    console.log(`📸 Fetching ${count} gallery images for layout: ${gallery.computed_layout || 'grid'}`);

    for (let i = 0; i < count; i++) {
      const itemQuery = items[i]?.image_search_query || globalQuery;
      // Vary the page to get different results for same industry
      const page = (i % 5) + 1;
      const searchUrl = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(itemQuery)}&orientation=landscape&per_page=1&page=${page}`;
      
      try {
        const searchRes = await fetchJson(searchUrl, headers);
        if (searchRes.results?.[0]) {
          const dest = path.join(outDir, `${brandSlug}-project-${i}.jpg`);
          await downloadToFile(searchRes.results[0].urls.regular, dest);
          console.log(`   Saved image ${i}: ${dest}`);
        }
      } catch (err) {
        console.error(`   Error fetching image ${i}:`, err.message);
      }
    }
  }
}

run().catch(console.error);
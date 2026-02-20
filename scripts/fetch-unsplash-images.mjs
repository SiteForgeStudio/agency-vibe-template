// scripts/fetch-unsplash-images.mjs
import fs from "node:fs";
import path from "node:path";

const UNSPLASH_API = "https://api.unsplash.com";

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Unsplash error ${res.status}`);
  return JSON.parse(await res.text());
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function run() {
  const slug = process.argv[2];
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    console.warn("⚠️  UNSPLASH_ACCESS_KEY not found. Skipping image download.");
    return;
  }

  const headers = { Authorization: `Client-ID ${accessKey}` };
  const clientDir = path.join("clients", slug);
  const outDir = path.join(clientDir, "assets", "images");
  
  if (!fs.existsSync(path.join(clientDir, "business.json"))) {
      console.error("❌ business.json not found. Run merge-json first.");
      process.exit(1);
  }

  const clientData = readJson(path.join(clientDir, "business.json"));
  ensureDir(outDir);
  const brandSlug = clientData?.brand?.slug || slug;

  // --- 1. HERO FETCH (With Skip Logic) ---
  const heroPath = path.join(outDir, `${brandSlug}-hero.jpg`);
  if (fs.existsSync(heroPath)) {
    console.log(`⏩ Skipping Hero: ${brandSlug}-hero.jpg already exists.`);
  } else {
    try {
      const heroQ = clientData.hero?.image?.image_search_query || "professional background";
      const heroData = await fetchJson(`${UNSPLASH_API}/search/photos?query=${encodeURIComponent(heroQ)}&orientation=landscape`, headers);
      if (heroData.results?.[0]) {
        await downloadToFile(heroData.results[0].urls.regular, heroPath);
        console.log("✅ Hero image saved.");
      }
    } catch (e) { console.warn("Failed hero fetch:", e.message); }
  }

  // --- 2. GALLERY FETCH (With Skip Logic) ---
  const gallery = clientData.gallery || {};
  if (clientData.strategy?.show_gallery !== false) {
    const count = gallery.computed_count || 6;
    const globalQ = gallery.image_source?.image_search_query || "service";
    
    for (let i = 0; i < count; i++) {
      const galleryPath = path.join(outDir, `${brandSlug}-project-${i}.jpg`);
      
      if (fs.existsSync(galleryPath)) {
        console.log(`⏩ Skipping Gallery ${i}: File already exists.`);
        continue;
      }

      try {
        const searchUrl = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(globalQ)}&orientation=landscape&page=${i+1}`;
        const data = await fetchJson(searchUrl, headers);
        if (data.results?.[0]) {
          await downloadToFile(data.results[0].urls.regular, galleryPath);
          console.log(`✅ Gallery image ${i} saved.`);
        }
      } catch (e) { console.warn(`Failed gallery image ${i}:`, e.message); }
    }
  }
}

run().catch(err => {
  console.error("Factory Fetch Error:", err);
  process.exit(0); 
});
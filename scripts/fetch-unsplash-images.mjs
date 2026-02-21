// scripts/fetch-unsplash-images.mjs
import fs from "node:fs";
import path from "node:path";

const UNSPLASH_API = "https://api.unsplash.com";

/**
 * UTILS
 */
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

/**
 * MAIN RUNNER
 */
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
  
  // 1. Check for merged business.json
  const businessPath = path.join(clientDir, "business.json");
  if (!fs.existsSync(businessPath)) {
      console.error("❌ business.json not found. Ensure merge-json.mjs runs before this script.");
      process.exit(1);
  }

  const clientData = readJson(businessPath);
  ensureDir(outDir);
  const brandSlug = clientData?.brand?.slug || slug;

  // --- 1. HERO FETCH (Prioritize specific query) ---
  const heroPath = path.join(outDir, `${brandSlug}-hero.jpg`);
  if (fs.existsSync(heroPath)) {
    console.log(`⏭️ Skipping Hero: ${brandSlug}-hero.jpg already exists.`);
  } else {
    try {
      const heroQ = clientData.hero?.image?.image_search_query || 
                    clientData.hero?.headline || 
                    "professional landscape";
      
      console.log(`🔍 Searching Hero: "${heroQ}"`);
      const heroData = await fetchJson(`${UNSPLASH_API}/search/photos?query=${encodeURIComponent(heroQ)}&orientation=landscape&per_page=1`, headers);
      
      if (heroData.results?.[0]) {
        await downloadToFile(heroData.results[0].urls.regular, heroPath);
        console.log("✅ Hero image saved.");
      }
    } catch (e) { console.warn("⚠️ Failed hero fetch:", e.message); }
  }

  // --- 2. GALLERY FETCH (Deep Search for Specific Items) ---
  const gallery = clientData.gallery || {};
  if (clientData.strategy?.show_gallery !== false) {
    const items = gallery.items || [];
    // Use the defined count, or fall back to the actual length of the items array
    const count = gallery.computed_count || items.length || 6;
    const globalQ = gallery.image_source?.image_search_query || clientData.intelligence?.industry || "service";
    
    console.log(`📸 Starting Gallery Fetch for ${count} items...`);

    for (let i = 0; i < count; i++) {
      const galleryPath = path.join(outDir, `${brandSlug}-project-${i}.jpg`);
      
      if (fs.existsSync(galleryPath)) {
        console.log(`⏭️ Skipping Gallery ${i}: File already exists.`);
        continue;
      }

      try {
        // Priority: 1. Individual query, 2. Item Title, 3. Global Industry query
        const rawItemQ = items[i]?.image_search_query || items[i]?.title || globalQ;
        const itemQ = `${rawItemQ} landscape`; // Add landscape hint to the search string

        console.log(`🔍 Searching Gallery ${i}: "${itemQ}"`);
        
        // We use per_page=1 to get the most relevant result for each specific query
        const searchUrl = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(itemQ)}&orientation=landscape&per_page=1&page=1`;
        const data = await fetchJson(searchUrl, headers);
        
        if (data.results?.[0]) {
          await downloadToFile(data.results[0].urls.regular, galleryPath);
          console.log(`✅ Gallery image ${i} saved.`);
        } else {
          console.warn(`❓ No results found for gallery item ${i}: "${itemQ}"`);
        }
      } catch (e) { console.warn(`⚠️ Failed gallery image ${i}:`, e.message); }
    }
  }
}

run().catch(err => {
  console.error("Factory Fetch Error:", err);
  process.exit(0); 
});
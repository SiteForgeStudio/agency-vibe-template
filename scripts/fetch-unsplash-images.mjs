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

function buildFallbackQueries(industry) {
  const base = industry || "professional service";
  return [`${base} detail`, `${base} workspace`, `${base} tools`, `${base} expert at work` ];
}

export default async function main(clientSlug) {
  const slug = clientSlug || process.argv[2];
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error("Missing UNSPLASH_ACCESS_KEY");

  const clientData = readJson(path.join("clients", slug, "business.json"));
  const outDir = path.join("clients", slug, "assets", "images");
  ensureDir(outDir);

  const brandSlug = clientData?.brand?.slug || slug;
  const headers = { Authorization: `Client-ID ${accessKey}` };

  // --- HERO ---
  const heroQ = clientData?.hero?.image?.image_search_query || clientData?.intelligence?.industry || "service";
  const heroData = await fetchJson(`${UNSPLASH_API}/search/photos?query=${encodeURIComponent(heroQ)}&orientation=landscape`, headers);
  const heroUrl = heroData?.results?.[0]?.urls?.regular;
  if (heroUrl) await downloadToFile(heroUrl, path.join(outDir, `${brandSlug}-hero.jpg`));

  // --- GALLERY ---
  const gallery = clientData?.gallery || {};
  const isEnabled = clientData?.strategy?.show_gallery !== false;
  
  if (isEnabled) {
    const items = Array.isArray(gallery.items) ? gallery.items : [];
    const count = gallery.computed_count || (items.length > 0 ? items.length : 6);
    const globalQ = gallery.image_source?.image_search_query || clientData?.intelligence?.industry || "professional";
    const fallbacks = buildFallbackQueries(clientData?.intelligence?.industry);

    console.log(`Fetching ${count} gallery images for ${brandSlug}...`);

    for (let i = 0; i < count; i++) {
      const specificQ = items[i]?.image_search_query || globalQ;
      const searchUrl = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(specificQ)}&orientation=landscape&page=${(i % 3) + 1}`;
      
      try {
        const data = await fetchJson(searchUrl, headers);
        const imgUrl = data?.results?.[Math.min(2, data.results.length - 1)]?.urls?.regular;
        if (imgUrl) await downloadToFile(imgUrl, path.join(outDir, `${brandSlug}-project-${i}.jpg`));
      } catch (e) {
        console.error(`Failed gallery image ${i}, skipping.`);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
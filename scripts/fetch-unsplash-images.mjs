// scripts/fetch-unsplash-images.mjs
import fs from "node:fs";
import path from "node:path";

const UNSPLASH_API = "https://api.unsplash.com";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Unsplash error ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

function safeQuery(q) {
  return String(q || "").trim().replace(/\s+/g, " ");
}

function buildFallbackQueries(industry) {
  const base = safeQuery(industry) || "local service";
  // Deliberately varied “subject action context” style queries
  return [
    `${base} professional working`,
    `${base} close up detail work`,
    `${base} tools on site`,
    `${base} premium service`,
    `${base} before and after`,
    `${base} customer service`,
    `${base} modern workspace`,
  ];
}

function pickSearchQuery({ business, galleryItem, fallbackQueries, idx }) {
  const fromItem = safeQuery(galleryItem?.image_search_query);
  if (fromItem) return fromItem;

  // If item has a title, use it as part of the query
  const title = safeQuery(galleryItem?.title);
  if (title) return safeQuery(`${business} ${title}`);

  // fallback: rotate through varied queries
  return fallbackQueries[idx % fallbackQueries.length];
}

function listExistingImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
}

export default async function main(clientSlug) {
  const slug = clientSlug || process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/fetch-unsplash-images.mjs <client_slug>");
    process.exit(1);
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error("Missing UNSPLASH_ACCESS_KEY");

  const clientJsonPath = path.join("clients", slug, "business.json");
  const clientData = readJson(clientJsonPath);

  const outDir = path.join("clients", slug, "assets", "images");
  ensureDir(outDir);

  // If you already have images, we still refresh to match current gallery/hero.
  // (You can change this behavior if you want caching.)
  for (const f of listExistingImages(outDir)) {
    fs.rmSync(path.join(outDir, f), { force: true });
  }

  const brandSlug = clientData?.brand?.slug || slug;

  // HERO
  const heroQuery = safeQuery(clientData?.hero?.image?.image_search_query) ||
    safeQuery(clientData?.intelligence?.industry) ||
    "professional service";
  const heroPage = 1;

  const heroSearchUrl =
    `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(heroQuery)}&orientation=landscape&per_page=30&page=${heroPage}`;
  const headers = { Authorization: `Client-ID ${accessKey}` };
  const heroData = await fetchJson(heroSearchUrl, headers);

  const heroResults = heroData?.results || [];
  if (heroResults.length === 0) throw new Error(`No Unsplash results for hero query: "${heroQuery}"`);

  // Use a non-1st image when possible to avoid “same image everywhere”
  const heroPick = heroResults[Math.min(3, heroResults.length - 1)];
  const heroUrl = heroPick?.urls?.regular || heroPick?.urls?.full;
  if (!heroUrl) throw new Error("No hero image URL found from Unsplash response");
  await downloadToFile(heroUrl, path.join(outDir, `${brandSlug}-hero.jpg`));

  // GALLERY
  const galleryEnabled = !!clientData?.gallery?.enabled;
  const galleryItems = Array.isArray(clientData?.gallery?.items) ? clientData.gallery.items : [];
  const industry = safeQuery(clientData?.intelligence?.industry);
  const fallbackQueries = buildFallbackQueries(industry);

  if (galleryEnabled && galleryItems.length > 0) {
    for (let i = 0; i < galleryItems.length; i++) {
      const item = galleryItems[i];
      const q = pickSearchQuery({
        business: industry,
        galleryItem: item,
        fallbackQueries,
        idx: i,
      });

      // vary page to diversify results for similar queries
      const page = (i % 3) + 1; // 1..3
      const searchUrl =
        `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=30&page=${page}`;

      const data = await fetchJson(searchUrl, headers);
      const results = data?.results || [];

      if (results.length === 0) {
        // hard fallback: use a generic but varied query
        const fb = fallbackQueries[i % fallbackQueries.length];
        const fbUrl =
          `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(fb)}&orientation=landscape&per_page=30&page=${page}`;
        const fbData = await fetchJson(fbUrl, headers);
        const fbResults = fbData?.results || [];
        if (fbResults.length === 0) continue;

        const pick = fbResults[Math.min(5, fbResults.length - 1)];
        const imgUrl = pick?.urls?.regular || pick?.urls?.full;
        if (imgUrl) {
          await downloadToFile(imgUrl, path.join(outDir, `${brandSlug}-project-${i}.jpg`));
        }
        continue;
      }

      const pick = results[Math.min(5, results.length - 1)];
      const imgUrl = pick?.urls?.regular || pick?.urls?.full;
      if (imgUrl) {
        await downloadToFile(imgUrl, path.join(outDir, `${brandSlug}-project-${i}.jpg`));
      }
    }
  }

  console.log(`Downloaded images to ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

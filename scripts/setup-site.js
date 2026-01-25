import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
// Using 'with' for Node v22 compatibility
import data from '../src/data/business.json' with { type: 'json' };

dotenv.config();

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const ASSETS_DIR = path.resolve('./src/assets/images');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

/**
 * 1. SLUG GENERATION
 * Prioritize the JSON slug, fallback to name-based generation.
 */
const brandSlug =
  data.brand?.slug ||
  (data.brand?.name || 'brand')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]/g, '-');

const brandName = data.brand?.name || 'brand';

/**
 * 2. IMAGE DOWNLOADER
 * Downloads from Unsplash and saves with the brand-specific prefix.
 */
async function searchUnsplashPhoto(query) {
  const res = await axios.get('https://api.unsplash.com/search/photos', {
    params: {
      query,
      orientation: 'landscape',
      per_page: 1
    },
    headers: {
      Authorization: `Client-ID ${ACCESS_KEY}`
    }
  });

  const first = res.data?.results?.[0];
  return first?.urls?.regular || null;
}

function buildFallbackQueries(query, industryFallback) {
  const q = (query || '').trim();
  const fallbacks = [];

  if (q) fallbacks.push(q);

  // soften common “over-specific” words
  if (q) {
    fallbacks.push(
      q.replace(/\b(close-up|closeup|professional|premium|luxury)\b/gi, '').replace(/\s+/g, ' ').trim()
    );
  }

  // take first 2–3 main tokens
  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    fallbacks.push(tokens.slice(0, 4).join(' '));
    fallbacks.push(tokens.slice(0, 2).join(' '));
  }

  // industry fallback
  if (industryFallback) fallbacks.push(industryFallback);

  // final safe defaults
  fallbacks.push('car detailing');
  fallbacks.push('car interior cleaning');

  // unique + non-empty
  return [...new Set(fallbacks)].filter(Boolean);
}

async function fetchUnsplashImage(query, filename) {
  const filePath = path.join(ASSETS_DIR, filename);

  if (fs.existsSync(filePath)) {
    console.log(`- Skipping ${filename} (Already exists)`);
    return;
  }

  const fallbacks = buildFallbackQueries(query, data?.intelligence?.industry);

  try {
    let downloadUrl = null;

    for (const q of fallbacks) {
      console.log(`🔍 Searching Unsplash for: "${q}"...`);
      downloadUrl = await searchUnsplashPhoto(q);
      if (downloadUrl) break;
    }

    if (!downloadUrl) {
      console.error(`! Unsplash: No results for "${query}" (and fallbacks)`);
      return;
    }

    const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    const errorMsg = error.response?.data?.errors?.[0] || error.message;
    console.error(`! Unsplash Error for ${filename}:`, errorMsg);
  }
}


/**
 * 3. RUNNER
 * Orchestrates the Hero and Gallery image naming/downloading.
 */
async function run() {
  if (!ACCESS_KEY) {
    console.error('❌ Error: UNSPLASH_ACCESS_KEY not found in .env file.');
    return;
  }

  console.log(`🚀 Starting Image Factory: ${brandName}`);

  // --- TASK 1: THE HERO ---
  const heroQuery = data?.hero?.image?.image_search_query;
  if (heroQuery) {
    const heroFilename = `${brandSlug}-hero.jpg`;
    await fetchUnsplashImage(heroQuery, heroFilename);
  } else {
    console.log('⚠️ Skipping hero image (missing data.hero.image.image_search_query)');
  }

  // --- TASK 2: THE GALLERY ---
  // Naming Convention: brand-slug-project-0.jpg

  const galleryObj = data.gallery;

  // Support BOTH shapes:
  // A) legacy: data.gallery = [ ... ]
  // B) elite:  data.gallery = { enabled, computed_count, image_source, items: [ ... ] }
  const isLegacyArray = Array.isArray(galleryObj);
  const galleryEnabled = isLegacyArray ? true : (galleryObj?.enabled !== false);
  const galleryItems = isLegacyArray ? galleryObj : (galleryObj?.items || []);

  if (galleryEnabled && galleryItems.length > 0) {
    const desiredCount =
      (!isLegacyArray && typeof galleryObj?.computed_count === 'number')
        ? galleryObj.computed_count
        : galleryItems.length;

    const itemsToProcess = galleryItems.slice(0, Math.max(0, desiredCount));

    console.log(`📸 Processing ${itemsToProcess.length} Gallery Slots...`);

    const globalQuery =
      (!isLegacyArray && galleryObj?.image_source?.image_search_query)
        ? galleryObj.image_source.image_search_query
        : '';

    for (const [index, item] of itemsToProcess.entries()) {
      const galleryQuery =
        item?.image_search_query ||
        globalQuery ||
        item?.alt ||
        data.intelligence?.industry ||
        'professional services';

      const galleryFilename = `${brandSlug}-project-${index}.jpg`;
      await fetchUnsplashImage(galleryQuery, galleryFilename);
    }
  } else {
    console.log('ℹ️ No gallery items to process (gallery disabled or empty).');
  }

  console.log('\n✅ Factory Complete. Assets ready in src/assets/images/');
  console.log(`💡 Assets prefixed with: ${brandSlug}-`);
}

run();

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
 * Standardizes the naming convention for all client assets.
 */
/**
 * 1. SLUG GENERATION
 * Prioritize the JSON slug, fallback to name-based generation.
 */
const brandSlug = data.brand?.slug || 
                 (data.brand?.name || 'brand')
                    .toLowerCase()
                    .replace(/'/g, '') 
                    .replace(/[^a-z0-9]/g, '-');

const brandName = data.brand?.name || 'brand';
/**
 * 2. IMAGE DOWNLOADER
 * Downloads from Unsplash and saves with the brand-specific prefix.
 */
async function fetchUnsplashImage(query, filename) {
    const filePath = path.join(ASSETS_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        console.log(`- Skipping ${filename} (Already exists)`);
        return;
    }

    try {
        console.log(`🔍 Searching Unsplash for: "${query}"...`);
        
        const search = await axios.get(`https://api.unsplash.com/photos/random`, {
            params: { 
                query: query, 
                orientation: 'landscape', 
                client_id: ACCESS_KEY 
            }
        });

        const downloadUrl = search.data.urls.regular;
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
        console.error("❌ Error: UNSPLASH_ACCESS_KEY not found in .env file.");
        return;
    }

    console.log(`🚀 Starting Image Factory: ${brandName}`);

    // --- TASK 1: THE HERO ---
    // Naming Convention: brand-slug-hero.jpg
    const heroQuery = data.hero?.image?.image_search_query || 
                      (data.intelligence?.industry && data.settings?.vibe 
                        ? `${data.intelligence.industry} ${data.settings.vibe} workspace`
                        : `${brandName} professional background`);
    
    const heroFilename = `${brandSlug}-hero.jpg`;
    await fetchUnsplashImage(heroQuery, heroFilename);

    // --- TASK 2: THE GALLERY ---
    // Naming Convention: brand-slug-project-0.jpg
    if (data.gallery && Array.isArray(data.gallery)) {
        console.log(`📸 Processing ${data.gallery.length} Gallery Slots...`);
        
        for (const [index, item] of data.gallery.entries()) {
            const galleryQuery = item.image_search_query || 
                                 item.alt || 
                                 data.intelligence?.industry || 
                                 "professional services";
            
            // We ignore the filename in JSON and force the indexed-slug naming convention
            const galleryFilename = `${brandSlug}-project-${index}.jpg`;
            await fetchUnsplashImage(galleryQuery, galleryFilename);
        }
    }

    console.log('\n✅ Factory Complete. Assets ready in src/assets/images/');
    console.log(`💡 Assets prefixed with: ${brandSlug}-`);
}

run();
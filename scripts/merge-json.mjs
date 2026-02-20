import fs from "node:fs";
import path from "node:path";

const readJson = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
};

// Verify the slug from CLI or Environment Variable
const slug = process.argv[2] || process.env.CLIENT_ID;

if (!slug) { 
  console.error("❌ Critical Error: No Client ID provided via argument or Environment Variable."); 
  process.exit(1); 
}

const base = readJson(path.join("clients", slug, "business.base.json"));
const updates = readJson(path.join("clients", slug, "business.updates.json")) || {};

if (!base) { 
  console.error(`❌ Critical Error: Missing business.base.json for ${slug}`); 
  process.exit(1); 
}

/**
 * 1. DEEP MERGE CORE OBJECTS
 * We use the 'updates' object directly (not updates.updates) 
 * to ensure we catch all top-level overrides.
 */
const merged = { 
  ...base, 
  ...updates,
  brand: { ...(base.brand || {}), ...(updates.brand || {}) },
  settings: { ...(base.settings || {}), ...(updates.settings || {}) },
  strategy: { ...(base.strategy || {}), ...(updates.strategy || {}) },
  gallery: { ...(base.gallery || {}), ...(updates.gallery || {}) },
  about: { ...(base.about || {}), ...(updates.about || {}) },
  hero: { ...(base.hero || {}), ...(updates.hero || {}) }
};

// 2. PROTECT LAYOUT STRATEGY
merged.gallery.computed_layout = updates.gallery?.computed_layout || base.gallery?.computed_layout || "grid";

// 3. HEALING LAYER (Fail-Safe)
// Ensure Nav is never empty
if (!merged.settings.menu || merged.settings.menu.length === 0) {
    merged.settings.menu = base.settings?.menu || [
        { label: "Home", path: "#home" },
        { label: "About", path: "#about" },
        { label: "Gallery", path: "#gallery" },
        { label: "Contact", path: "#contact" }
    ];
}

// Ensure Gallery has items to prevent "Ghost Gallery"
if (merged.strategy.show_gallery && (!merged.gallery.items || merged.gallery.items.length === 0)) {
    const count = merged.gallery.computed_count || 6;
    merged.gallery.items = Array.from({ length: count }).map((_, i) => ({
        title: `Project ${i + 1}`
    }));
}

// 4. WRITE FINAL - This is what Astro/Netlify will actually read
writeJson(path.join("clients", slug, "business.json"), merged);
console.log(`✅ Factory Data Merged & Strategy Preserved: ${slug}`);
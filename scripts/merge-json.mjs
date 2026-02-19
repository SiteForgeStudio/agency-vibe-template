// scripts/merge-json.mjs
import fs from "node:fs";
import path from "node:path";

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function deepMerge(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return b;
  if (isObject(a) && isObject(b)) {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b === undefined ? a : b;
}

function normalizeSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isNewSchema(obj) {
  return (
    !!obj && isObject(obj) && isObject(obj.intelligence) &&
    isObject(obj.brand) && isObject(obj.hero)
  );
}

function migrateLegacyToNew(legacy) {
  const strategy = legacy?.strategy || {};
  const brand = legacy?.brand || {};
  
  return {
    intelligence: legacy.intelligence || { industry: "local services", target_persona: "customers", tone_of_voice: "professional" },
    strategy: {
      show_trustbar: !!strategy.show_trustbar,
      show_about: strategy.show_about !== false,
      show_features: strategy.show_features !== false,
      show_events: !!strategy.show_events,
      show_process: !!strategy.show_process,
      show_testimonials: !!strategy.show_testimonials,
      show_comparison: !!strategy.show_comparison,
      show_gallery: strategy.show_gallery !== false,
      show_investment: !!strategy.show_investment,
      show_faqs: !!strategy.show_faqs,
      show_service_area: !!strategy.show_service_area,
    },
    settings: legacy.settings || { vibe: "Modern Minimal", cta_text: "Get Started", cta_link: "#contact" },
    brand: {
      name: brand.name || "Your Business",
      slug: normalizeSlug(brand.slug || brand.name || "brand"),
      tagline: brand.tagline || "Professional Service",
      email: brand.email || "",
      phone: brand.phone || "",
      objection_handle: brand.objection_handle || ""
    },
    hero: legacy.hero || { headline: "Welcome", subtext: "Service you can trust", image: { alt: "Hero", image_search_query: "professional service" } },
    about: legacy.about || { story_text: "", founder_note: "", years_experience: "" },
    features: legacy.features || [],
    gallery: legacy.gallery || { enabled: true, computed_layout: "grid", items: [] },
    contact: legacy.contact || { headline: "Contact Us", subheadline: "", email_recipient: "", button_text: "Submit" }
  };
}

const clientSlug = process.argv[2];
if (!clientSlug) {
  console.error("Usage: node scripts/merge-json.mjs <client_slug>");
  process.exit(1);
}

const basePath = path.join("clients", clientSlug, "business.base.json");
const updatesPath = path.join("clients", clientSlug, "business.updates.json");
const outPath = path.join("clients", clientSlug, "business.json");

const baseRaw = readJson(basePath) || {};
const updatesRaw = readJson(updatesPath) || {};

// If base isn't in new format, migrate it first
const base = isNewSchema(baseRaw) ? baseRaw : migrateLegacyToNew(baseRaw);
// Updates can be partial or full
const merged = deepMerge(base, updatesRaw);

// Final safety on brand slug and gallery structure
merged.brand.slug = normalizeSlug(merged.brand.slug || clientSlug);
if (!merged.gallery) merged.gallery = { enabled: true, computed_layout: "grid", items: [] };

writeJson(outPath, merged);
console.log(`Wrote ${outPath}`);
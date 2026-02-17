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

function titleFromAnchor(anchor) {
  const map = {
    "#home": "Home",
    "#about": "About",
    "#features": "Features",
    "#events": "Events",
    "#process": "Process",
    "#testimonials": "Testimonials",
    "#comparison": "Comparison",
    "#gallery": "Gallery",
    "#investment": "Investment",
    "#faqs": "FAQs",
    "#service-area": "Service Area",
    "#contact": "Contact",
  };
  return map[anchor] || anchor.replace(/^#/, "").replace(/-/g, " ");
}

function isNewSchema(obj) {
  // “new schema” signals (Master Manifest 2026)
  return (
    !!obj &&
    isObject(obj) &&
    isObject(obj.intelligence) &&
    typeof obj.intelligence.industry === "string" &&
    isObject(obj.brand) &&
    typeof obj.brand.name === "string" &&
    isObject(obj.hero) &&
    typeof obj.hero.subtext === "string"
  );
}

function isLegacySchema(obj) {
  // “legacy schema” signals (your older generate output)
  return (
    !!obj &&
    isObject(obj) &&
    isObject(obj.intelligence) &&
    (typeof obj.intelligence.business_name === "string" ||
      typeof obj.intelligence.site_for === "string")
  );
}

function migrateLegacyToNew(legacy) {
  // Best-effort migration so Astro can render ALL sections deterministically.
  const intelligenceLegacy = legacy?.intelligence || {};
  const strategyLegacy = legacy?.strategy || {};
  const settingsLegacy = legacy?.settings || {};
  const brandLegacy = legacy?.brand || {};
  const heroLegacy = legacy?.hero || {};
  const aboutLegacy = legacy?.about || {};
  const featuresLegacy = legacy?.features || [];
  const contactLegacy = legacy?.contact || {};
  const serviceAreaLegacy = legacy?.service_area || legacy?.serviceArea || {};

  const businessName =
    intelligenceLegacy.business_name ||
    brandLegacy.logo_text ||
    brandLegacy.name ||
    "Your Business";

  const siteFor = intelligenceLegacy.site_for || "";
  // crude industry inference fallback (better comes from your new generate)
  const industry =
    (typeof siteFor === "string" && siteFor.trim()) ||
    "local services";

  const tone =
    intelligenceLegacy.tone_hint ||
    intelligenceLegacy.tone_of_voice ||
    "friendly and professional";

  const persona =
    "Local customers seeking a high-quality service";

  const slug = normalizeSlug(
    brandLegacy.slug || brandLegacy.name || brandLegacy.logo_text || businessName
  );

  // legacy menus were ["#home", "#about", ...]
  const legacyMenu = Array.isArray(settingsLegacy.menu)
    ? settingsLegacy.menu
    : Array.isArray(strategyLegacy.menu)
      ? strategyLegacy.menu
      : [];

  const menu =
    legacyMenu.length > 0
      ? legacyMenu.map((p) => ({ label: titleFromAnchor(p), path: p }))
      : [
          { label: "Home", path: "#home" },
          { label: "About", path: "#about" },
          { label: "Features", path: "#features" },
          { label: "Contact", path: "#contact" },
        ];

  const vibe =
    settingsLegacy.vibe ||
    "Modern Minimal";

  // strategy booleans weren’t present in legacy — give safe defaults that
  // still allow the template to render sections if content exists later.
  const showEvents = !!strategyLegacy.show_events;

  const migrated = {
    intelligence: {
      industry: String(industry).trim() || "local services",
      target_persona: persona,
      tone_of_voice: String(tone).trim() || "friendly and professional",
    },
    strategy: {
      show_trustbar: false,
      show_about: true,
      show_features: true,
      show_events: showEvents,
      show_process: true,
      show_testimonials: true,
      show_comparison: false,
      show_gallery: true,
      show_investment: true,
      show_faqs: true,
      show_service_area: true,
    },
    settings: {
      vibe,
      cta_text: "Get Started",
      cta_link: "#contact",
      cta_type: "anchor",
      secondary_cta_text: "",
      secondary_cta_link: "",
      menu,
    },
    brand: {
      name: brandLegacy.name || brandLegacy.logo_text || businessName,
      slug,
      tagline: brandLegacy.tagline || "A service you can trust",
      email: brandLegacy.email || contactLegacy.email_recipient || "",
      phone: brandLegacy.phone || "",
      office_address: brandLegacy.office_address || "",
      objection_handle: brandLegacy.objection_handle || "",
    },
    hero: {
      headline:
        heroLegacy.headline || `Welcome to ${businessName}`,
      subtext:
        heroLegacy.subheadline ||
        heroLegacy.subtext ||
        "Professional service designed around your needs.",
      image: {
        alt:
          heroLegacy?.image?.alt || "Hero image",
        image_search_query:
          heroLegacy?.image?.image_search_query || "local service professional at work",
      },
    },
    about: {
      story_text:
        aboutLegacy.content ||
        aboutLegacy.story_text ||
        `${businessName} serves customers with a focus on quality, convenience, and care.`,
      founder_note:
        aboutLegacy.founder_note ||
        "Owner-led and detail-focused.",
      years_experience:
        aboutLegacy.years_experience ||
        "Newly launched",
    },
    features: Array.isArray(featuresLegacy) ? featuresLegacy : [],
    contact: {
      headline: contactLegacy.headline || "Get in touch",
      subheadline: contactLegacy.subheadline || "We’d love to help. Reach out today.",
      email_recipient:
        contactLegacy.email_recipient || brandLegacy.email || "",
      button_text: contactLegacy.button_text || "Contact Us",
      email: brandLegacy.email || "",
      phone: brandLegacy.phone || "",
      office_address: brandLegacy.office_address || "",
    },
  };

  // Service area normalization
  const mainCity =
    intelligenceLegacy.main_city ||
    serviceAreaLegacy.main_city ||
    "";

  const surrounding =
    serviceAreaLegacy.surrounding_cities ||
    serviceAreaLegacy.locations ||
    [];

  if (mainCity || (Array.isArray(surrounding) && surrounding.length)) {
    migrated.service_area = {
      main_city: mainCity || "Our Region",
      surrounding_cities: Array.isArray(surrounding) ? surrounding : [],
      travel_note:
        serviceAreaLegacy.travel_note ||
        "Outside these areas? We offer custom quotes for extended travel.",
      cta_text: "Request a Quote",
      cta_link: "#contact",
    };
  }

  return migrated;
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

// 1) Normalize base + updates into the NEW schema if needed
const base =
  isNewSchema(baseRaw)
    ? baseRaw
    : isLegacySchema(baseRaw)
      ? migrateLegacyToNew(baseRaw)
      : baseRaw;

const updates =
  isNewSchema(updatesRaw)
    ? updatesRaw
    : isLegacySchema(updatesRaw)
      ? migrateLegacyToNew(updatesRaw)
      : updatesRaw;

// 2) Merge (updates overrides base)
const merged = deepMerge(base, updates);

// 3) Guarantee a stable brand.slug
merged.brand = merged.brand || {};
merged.brand.slug = normalizeSlug(
  merged.brand.slug || merged.brand.name || clientSlug
);

// 4) If menu exists, ensure it’s array of {label,path} objects
if (Array.isArray(merged?.settings?.menu)) {
  const menuOk = merged.settings.menu.every(
    (x) => x && typeof x === "object" && typeof x.label === "string" && typeof x.path === "string"
  );

  if (!menuOk) {
    // try to coerce from anchor strings
    merged.settings.menu = merged.settings.menu
      .filter((x) => typeof x === "string")
      .map((p) => ({ label: titleFromAnchor(p), path: p }));
  }
}

// 5) Write merged
writeJson(outPath, merged);
console.log(`Wrote ${outPath}`);

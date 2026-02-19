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

const clientSlug = process.argv[2];
const basePath = path.join("clients", clientSlug, "business.base.json");
const updatesPath = path.join("clients", clientSlug, "business.updates.json");
const outPath = path.join("clients", clientSlug, "business.json");

const baseData = readJson(basePath);
if (!baseData) {
  console.error("❌ No business.base.json found!");
  process.exit(1);
}

const updatesData = readJson(updatesPath) || {};

// Standardized Merge
const merged = {
  ...baseData,
  ...updatesData,
  brand: { ...baseData.brand, ...updatesData.brand },
  strategy: { ...baseData.strategy, ...updatesData.strategy },
  settings: { ...baseData.settings, ...updatesData.settings },
  gallery: { ...baseData.gallery, ...updatesData.gallery }
};

// Force lowercase slug for asset matching
merged.brand.slug = (merged.brand.slug || merged.brand.name || clientSlug)
  .toLowerCase().replace(/[^a-z0-9]/g, '-');

writeJson(outPath, merged);
console.log(`✅ Merged business.json created for ${clientSlug}`);
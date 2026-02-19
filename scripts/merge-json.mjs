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

const base = readJson(basePath);
if (!base) {
    console.error("❌ Critical: business.base.json missing.");
    process.exit(1);
}

const updates = readJson(updatesPath) || {};

// TRANSPARENT MERGE: No hardcoded defaults, no "migrations"
// We trust the AI's structure from Pass 2.
const merged = {
  ...base,
  ...updates,
  strategy: { ...(base.strategy || {}), ...(updates.strategy || {}) },
  settings: { ...(base.settings || {}), ...(updates.settings || {}) },
  brand: { ...(base.brand || {}), ...(updates.brand || {}) }
};

// Force a clean slug
merged.brand.slug = (merged.brand?.slug || merged.brand?.name || clientSlug)
  .toLowerCase().replace(/[^a-z0-9]/g, "-");

writeJson(outPath, merged);
console.log(`✅ Success: Merged business.json created for ${clientSlug}`);
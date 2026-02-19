import fs from "node:fs";
import path from "node:path";

const readJson = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
const writeJson = (p, obj) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
};

const slug = process.argv[2];
const base = readJson(path.join("clients", slug, "business.base.json"));
const updates = readJson(path.join("clients", slug, "business.updates.json")) || {};

if (!base) { console.error("Missing base JSON"); process.exit(1); }

// SIMPLE MERGE: No legacy logic. No structural changes.
const merged = { ...base, ...updates };

// Force lowercase slug for asset matching consistency
merged.brand.slug = (merged.brand.slug || slug).toLowerCase().replace(/[^a-z0-9]/g, "-");

writeJson(path.join("clients", slug, "business.json"), merged);
console.log(`✅ Factory Data Ready: ${slug}`);
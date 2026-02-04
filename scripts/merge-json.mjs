import fs from "fs";
import path from "path";

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, updates) {
  if (Array.isArray(base) || Array.isArray(updates)) return updates ?? base; // arrays replace
  if (!isObject(base) || !isObject(updates)) return updates ?? base;

  const out = { ...base };
  for (const [k, v] of Object.entries(updates)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/merge-json.mjs <slug>");
  process.exit(1);
}

const clientDir = path.join(process.cwd(), "clients", slug);
const basePath = path.join(clientDir, "business.base.json");
const updatesPath = path.join(clientDir, "business.updates.json");
const outPath = path.join(clientDir, "business.json");

if (!fs.existsSync(basePath)) {
  console.error(`Missing: ${basePath}`);
  process.exit(1);
}

const base = readJsonIfExists(basePath) ?? {};
const updates = readJsonIfExists(updatesPath) ?? {};
const merged = deepMerge(base, updates);

fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
console.log(`Wrote: ${outPath}`);

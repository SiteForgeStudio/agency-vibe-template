import fs from "fs";
import path from "path";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/prepare-build.mjs <slug>");
  process.exit(1);
}

const root = process.cwd();
const clientDir = path.join(root, "clients", slug);

const mergedBusiness = path.join(clientDir, "business.json");
if (!fs.existsSync(mergedBusiness)) {
  console.error(`Missing merged business.json: ${mergedBusiness}`);
  process.exit(1);
}

// Where your app expects these:
const appBusinessPath = path.join(root, "src", "data", "business.json");
const appAssetsImages = path.join(root, "src", "assets", "images");

// Where your client images will live:
const clientImages = path.join(clientDir, "assets", "images");

// 1) Copy JSON
ensureDir(path.dirname(appBusinessPath));
fs.copyFileSync(mergedBusiness, appBusinessPath);
console.log(`Copied business.json -> ${appBusinessPath}`);

// 2) Wipe images to prevent cross-client bleed + dist bloat
ensureDir(appAssetsImages);
rmDirContents(appAssetsImages);
console.log(`Cleared -> ${appAssetsImages}`);

// 3) Copy only this client's images (if any)
copyDir(clientImages, appAssetsImages);
console.log(`Copied images from -> ${clientImages}`);

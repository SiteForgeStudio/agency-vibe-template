console.log("\nDEBUG prepare-assets");

console.log("CLIENT_ID:", slug);

console.log("Looking in:", astroGeneratedDir);

if (fs.existsSync(astroGeneratedDir)) {

  const files = fs.readdirSync(astroGeneratedDir);

  console.log("Files found:", files.length);

  files.forEach(f => console.log(" -", f));

}
else {
  console.log("Directory does not exist");
}


import fs from "node:fs";
import path from "node:path";

const clientId = process.argv[2];

if (!clientId) {
  console.error("❌ prepare-assets: Missing clientId");
  process.exit(1);
}

const generatedDir = path.resolve(`src/assets/generated/${clientId}`);

console.log(`Preparing assets for client: ${clientId}`);
console.log(`Checking: ${generatedDir}`);

if (!fs.existsSync(generatedDir)) {
  console.error("❌ Generated assets folder does not exist.");
  process.exit(1);
}

const files = fs.readdirSync(generatedDir).filter(f =>
  /\.(jpg|jpeg|png|webp)$/i.test(f)
);

if (files.length === 0) {
  console.error("❌ No images found in generated folder.");
  process.exit(1);
}

console.log(`✅ Found ${files.length} generated images.`);
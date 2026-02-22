import fs from "fs";
import path from "path";
import https from "https";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node fetch-unsplash-images.mjs <slug>");
  process.exit(1);
}

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error("Missing UNSPLASH_ACCESS_KEY");
  process.exit(1);
}

// ✅ WRITE TO SOURCE OF TRUTH (clients layer)
const outDir = path.join("clients", slug, "generated");
fs.mkdirSync(outDir, { recursive: true });

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function fetchImage(query) {
  const apiUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`;
  
  return new Promise((resolve, reject) => {
    https.get(apiUrl, {
      headers: { Authorization: `Client-ID ${ACCESS_KEY}` }
    }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.urls?.regular);
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("Generating images for:", slug);

  // Hero
  const heroUrl = await fetchImage(`${slug} modern architecture`);
  const heroPath = path.join(outDir, `${slug}-hero.jpg`);
  if (heroUrl) {
    await downloadImage(heroUrl, heroPath);
    console.log("Saved hero:", heroPath);
  }

  // Gallery (7 images default)
  for (let i = 0; i < 7; i++) {
    const imgUrl = await fetchImage(`${slug} project ${i}`);
    const imgPath = path.join(outDir, `${slug}-project-${i}.jpg`);
    if (imgUrl) {
      await downloadImage(imgUrl, imgPath);
      console.log("Saved gallery:", imgPath);
    }
  }

  console.log("Image generation complete.");
}

run().catch(err => {
  console.error("Image generation failed:", err);
  process.exit(1);
});
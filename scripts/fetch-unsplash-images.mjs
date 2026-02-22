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

/**
 * FACTORY PATHS
 *
 * clients/{slug}/generated      ← source of truth
 * src/assets/generated/{slug}   ← Astro build layer
 */

const clientsDir = path.resolve("clients", slug, "generated");
const astroDir = path.resolve("src", "assets", "generated", slug);

// Ensure both directories exist
fs.mkdirSync(clientsDir, { recursive: true });
fs.mkdirSync(astroDir, { recursive: true });

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {

    const clientsPath = path.join(clientsDir, filename);
    const astroPath = path.join(astroDir, filename);

    const tempPath = clientsPath + ".tmp";

    const file = fs.createWriteStream(tempPath);

    https.get(url, res => {

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.pipe(file);

      file.on("finish", () => {

        file.close(() => {

          // Move to clients source-of-truth
          fs.renameSync(tempPath, clientsPath);

          // Copy into Astro layer
          fs.copyFileSync(clientsPath, astroPath);

          resolve();

        });

      });

    }).on("error", err => {

      fs.unlink(tempPath, () => {});
      reject(err);

    });

  });
}

async function fetchImage(query) {

  const apiUrl =
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`;

  return new Promise((resolve, reject) => {

    https.get(apiUrl, {
      headers: {
        Authorization: `Client-ID ${ACCESS_KEY}`
      }
    }, res => {

      let data = "";

      res.on("data", chunk => data += chunk);

      res.on("end", () => {

        try {

          const json = JSON.parse(data);

          if (!json.urls?.regular) {
            reject(new Error("No image URL returned"));
            return;
          }

          resolve(json.urls.regular);

        } catch (err) {

          reject(err);

        }

      });

    }).on("error", reject);

  });
}

async function run() {

  console.log(`Factory image generation started for: ${slug}`);

  console.log("Clients layer:", clientsDir);
  console.log("Astro layer:", astroDir);

  // HERO IMAGE

  const heroFile = `${slug}-hero.jpg`;

  try {

    const heroUrl = await fetchImage(`${slug} modern architecture`);

    await downloadImage(heroUrl, heroFile);

    console.log("✓ Hero saved:", heroFile);

  } catch (err) {

    console.error("Hero generation failed:", err);

  }

  // GALLERY IMAGES

  const galleryCount = 7;

  for (let i = 0; i < galleryCount; i++) {

    const filename = `${slug}-project-${i}.jpg`;

    try {

      const imgUrl = await fetchImage(`${slug} project ${i}`);

      await downloadImage(imgUrl, filename);

      console.log("✓ Gallery saved:", filename);

    } catch (err) {

      console.error(`Gallery image ${i} failed:`, err);

    }

  }

  console.log("Factory image generation complete.");

}

run().catch(err => {

  console.error("Factory image generation failed:", err);

  process.exit(1);

});
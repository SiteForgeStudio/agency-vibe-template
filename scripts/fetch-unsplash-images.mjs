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
 * Factory paths
 */

const clientDir = path.resolve("clients", slug);
const clientJsonPath = path.join(clientDir, "business.json");

const clientsGeneratedDir = path.join(clientDir, "generated");
const astroGeneratedDir = path.resolve("src", "assets", "generated", slug);

fs.mkdirSync(clientsGeneratedDir, { recursive: true });
fs.mkdirSync(astroGeneratedDir, { recursive: true });

/**
 * Load client.json
 */

if (!fs.existsSync(clientJsonPath)) {
  console.error("Missing client.json at:", clientJsonPath);
  process.exit(1);
}

const clientData = JSON.parse(
  fs.readFileSync(clientJsonPath, "utf-8")
);

console.log("Loaded client config");

/**
 * Download helper
 */

function downloadImage(url, filename) {

  return new Promise((resolve, reject) => {

    const clientPath = path.join(clientsGeneratedDir, filename);
    const astroPath = path.join(astroGeneratedDir, filename);

    const tempPath = clientPath + ".tmp";

    const file = fs.createWriteStream(tempPath);

    https.get(url, res => {

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.pipe(file);

      file.on("finish", () => {

        file.close(() => {

          fs.renameSync(tempPath, clientPath);
          fs.copyFileSync(clientPath, astroPath);

          resolve();

        });

      });

    }).on("error", err => {

      fs.unlink(tempPath, () => {});
      reject(err);

    });

  });

}

/**
 * Unsplash fetch
 */

function fetchImage(query) {

  const url =
    `https://api.unsplash.com/photos/random?orientation=landscape&query=${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {

    https.get(url, {
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

            console.error("Unsplash response:", json);

            reject(new Error("No image URL returned"));
            return;

          }

          resolve(json.urls.regular);

        }
        catch (err) {
          reject(err);
        }

      });

    }).on("error", reject);

  });

}

/**
 * Main run
 */

async function run() {

  console.log("Factory image generation started for:", slug);

  // HERO

  const heroQuery =
    clientData.hero?.image?.image_search_query;

  if (heroQuery) {

    try {

      const url = await fetchImage(heroQuery);

      const filename = `${slug}-hero.jpg`;

      await downloadImage(url, filename);

      console.log("✓ Hero generated:", heroQuery);

    }
    catch (err) {
      console.error("Hero failed:", err);
    }

  }
  else {

    console.warn("No hero query found");

  }

  // GALLERY

  const galleryItems =
    clientData.gallery?.items || [];

  for (let i = 0; i < galleryItems.length; i++) {

    const item = galleryItems[i];

    if (!item.image_search_query) continue;

    try {

      const url =
        await fetchImage(item.image_search_query);

      const filename =
        `${slug}-project-${i}.jpg`;

      await downloadImage(url, filename);

      console.log(
        "✓ Gallery generated:",
        item.image_search_query
      );

    }
    catch (err) {

      console.error(
        "Gallery failed:",
        item.image_search_query,
        err
      );

    }

  }

  console.log("Factory image generation complete");

}

run().catch(err => {

  console.error(err);

  process.exit(1);

});
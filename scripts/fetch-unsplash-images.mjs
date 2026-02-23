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
 *
 * clients/{slug}/business.json       ← intake source of truth
 * clients/{slug}/generated          ← persistent factory layer
 * src/assets/generated/{slug}       ← Astro build layer
 */

const clientDir = path.resolve("clients", slug);

const businessJsonPath =
  path.join(clientDir, "business.json");

const clientsGeneratedDir =
  path.join(clientDir, "generated");

const astroGeneratedDir =
  path.resolve(
    "src",
    "assets",
    "generated",
    slug
  );

/**
 * Ensure directories exist
 */

fs.mkdirSync(clientsGeneratedDir, { recursive: true });
fs.mkdirSync(astroGeneratedDir, { recursive: true });

/**
 * Load business.json
 */

if (!fs.existsSync(businessJsonPath)) {

  console.error(
    "Missing business.json at:",
    businessJsonPath
  );

  process.exit(1);

}

const clientData =
  JSON.parse(
    fs.readFileSync(
      businessJsonPath,
      "utf-8"
    )
  );

console.log("✓ Loaded business.json");


/**
 * Download helper
 */

function downloadImage(url, filename) {

  return new Promise((resolve, reject) => {

    const clientPath =
      path.join(
        clientsGeneratedDir,
        filename
      );

    const astroPath =
      path.join(
        astroGeneratedDir,
        filename
      );

    // Skip download if already exists (factory-safe)
    if (fs.existsSync(clientPath)) {

      fs.copyFileSync(clientPath, astroPath);

      console.log(
        "• Already exists, reused:",
        filename
      );

      resolve();

      return;

    }

    const tempPath =
      clientPath + ".tmp";

    const file =
      fs.createWriteStream(tempPath);

    https.get(url, res => {

      if (res.statusCode !== 200) {

        reject(
          new Error(
            `HTTP ${res.statusCode}`
          )
        );

        return;

      }

      res.pipe(file);

      file.on("finish", () => {

        file.close(() => {

          fs.renameSync(
            tempPath,
            clientPath
          );

          fs.copyFileSync(
            clientPath,
            astroPath
          );

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
 * Unsplash fetch helper
 */

function fetchImage(query) {

  const url =
    `https://api.unsplash.com/photos/random` +
    `?orientation=landscape` +
    `&query=${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {

    https.get(url, {

      headers: {
        Authorization:
          `Client-ID ${ACCESS_KEY}`
      }

    }, res => {

      let data = "";

      res.on(
        "data",
        chunk => data += chunk
      );

      res.on("end", () => {

        try {

          const json =
            JSON.parse(data);

          if (!json.urls?.regular) {

            console.error(
              "Unsplash bad response:",
              json
            );

            reject(
              new Error(
                "No image URL returned"
              )
            );

            return;

          }

          resolve(
            json.urls.regular
          );

        }
        catch (err) {

          reject(err);

        }

      });

    }).on("error", reject);

  });

}


/**
 * Main factory run
 */

async function run() {

  console.log(
    "Factory image generation started:",
    slug
  );

  /**
   * HERO
   */

  const heroQuery =
    clientData.hero?.image
      ?.image_search_query;

  if (heroQuery) {

    try {

      const url =
        await fetchImage(heroQuery);

      await downloadImage(
        url,
        `${slug}-hero.jpg`
      );

      console.log(
        "✓ Hero generated"
      );

    }
    catch (err) {

      console.error(
        "Hero failed:",
        err.message
      );

    }

  }
  else {

    console.warn(
      "• No hero search query defined"
    );

  }


  /**
   * GALLERY
   */

  const galleryItems =
    clientData.gallery?.items || [];

  for (let i = 0; i < galleryItems.length; i++) {

    const query =
      galleryItems[i]
        ?.image_search_query;

    if (!query) {

      console.warn(
        `• Gallery item ${i} missing query`
      );

      continue;

    }

    try {

      const url =
        await fetchImage(query);

      await downloadImage(
        url,
        `${slug}-project-${i}.jpg`
      );

      console.log(
        `✓ Gallery ${i} generated`
      );

    }
    catch (err) {

      console.error(
        `Gallery ${i} failed:`,
        err.message
      );

    }

  }

  console.log(
    "✓ Factory image generation complete"
  );

}

run().catch(err => {

  console.error(
    "Factory failed:",
    err
  );

  process.exit(1);

});

/**
 * DEBUG: VERIFY FILE OUTPUT
 */

function listDir(dir, label) {

  console.log(`\nDEBUG: Listing ${label}`);

  if (!fs.existsSync(dir)) {
    console.log("Directory does not exist:", dir);
    return;
  }

  const files = fs.readdirSync(dir);

  if (files.length === 0) {
    console.log("Directory is EMPTY");
    return;
  }

  files.forEach(file => {
    console.log(" -", file);
  });
}

listDir(clientsGeneratedDir, "CLIENTS GENERATED");
listDir(astroGeneratedDir, "ASTRO GENERATED");

console.log("\nFactory image generation complete.");
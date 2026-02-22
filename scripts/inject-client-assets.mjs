import fs from "fs";
import path from "path";

const CLIENT_ID = process.env.CLIENT_ID;

if (!CLIENT_ID) {
  console.error("CLIENT_ID is required");
  process.exit(1);
}

const source = path.join("clients", CLIENT_ID, "generated");
const targetRoot = path.join("src", "assets", "generated");
const target = path.join(targetRoot, CLIENT_ID);

// 🔥 HARD RESET of build staging layer
fs.rmSync(targetRoot, { recursive: true, force: true });

if (!fs.existsSync(source)) {
  console.error("Source images missing:", source);
  process.exit(1);
}

// Recreate clean staging area
fs.mkdirSync(targetRoot, { recursive: true });

// Copy only this client's assets
fs.cpSync(source, target, { recursive: true });

console.log("Injected assets for:", CLIENT_ID);
console.log("Injected files:", fs.readdirSync(target));
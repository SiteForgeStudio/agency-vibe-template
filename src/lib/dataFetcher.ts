import fs from 'node:fs';
import path from 'node:path';

/**
 * getClientData
 * Programmatically loads the merged business.json for the current build.
 */
export function getClientData() {
  // Pull the ID set during the build command (e.g., CLIENT_ID=heritage-watch-test)
  const clientId = process.env.CLIENT_ID;

  if (!clientId) {
    throw new Error("❌ Factory Error: CLIENT_ID environment variable is not set.");
  }

  // Resolve the path to the merged business.json (created by merge-json.mjs)
  const filePath = path.resolve(`./clients/${clientId}/business.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Factory Error: Merged data not found for "${clientId}" at ${filePath}. Run the merger first.`);
  }

  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`❌ Factory Error: Failed to parse JSON for "${clientId}". Check file formatting.`);
  }
}
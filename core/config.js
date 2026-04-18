const fs = require("fs");
const path = require("path");

let config;

try {
  const raw = fs.readFileSync(path.join(process.cwd(), "config.json"), "utf8");
  config = JSON.parse(raw);
} catch {
  throw new Error("config.json not found or invalid JSON.");
}

module.exports = config;

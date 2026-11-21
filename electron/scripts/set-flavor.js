// Writes flavor.json ({ "flavor": "dev" | "live" }) next to main.js so the
// packaged app knows which site URL to load. Run by the npm scripts before
// electron / electron-builder; never committed as a hand-edited file.
const fs = require("node:fs");
const path = require("node:path");

const flavor = process.argv[2];
if (flavor !== "dev" && flavor !== "live") {
  console.error("usage: node scripts/set-flavor.js <dev|live>");
  process.exit(1);
}
fs.writeFileSync(
  path.join(__dirname, "..", "flavor.json"),
  JSON.stringify({ flavor }, null, 2) + "\n",
);
console.log(`flavor set: ${flavor}`);

/* Lab 1 step 1: record YOUR toolchain, then write it into README.md and LAPORAN.md.
 *   node tools/record_toolchain.mjs "Chrome 130.0.1" ["Windows 11 23H2"]
 * Browser version cannot be read from Node: pass it (chrome://version or about:). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
const browser = process.argv[2];
if (!browser) { console.error('usage: node tools/record_toolchain.mjs "<browser + version>" ["<OS override>"]'); process.exit(1); }
const osName = process.argv[3] || `${os.type()} ${os.release()} ${os.arch()}`;
const three = JSON.parse(readFileSync("package.json", "utf8")).devDependencies.three;
const threeInstalled = existsSync("node_modules/three/package.json")
  ? JSON.parse(readFileSync("node_modules/three/package.json", "utf8")).version : `${three} (belum npm install)`;
const date = new Date().toISOString().slice(0, 10);
const rows = { OS: osName, Node: process.version, Browser: browser, "Three.js": threeInstalled, Date: date };
const labelId = { OS: "OS", Node: "Node", Browser: "Browser", "Three.js": "Three.js", Date: "Tanggal" };

function patch(file, labelFor) {
  let t = readFileSync(file, "utf8");
  for (const [k, v] of Object.entries(rows)) {
    const re = new RegExp(`^(\\| ${labelFor(k)} \\| ).*(\\|)\\s*$`, "m");
    if (!re.test(t)) { console.warn(`  ! ${file}: row '${labelFor(k)}' not found`); continue; }
    t = t.replace(re, `$1${v} $2`);
  }
  writeFileSync(file, t); console.log(`updated ${file}`);
}
patch("README.md", (k) => k);
patch("LAPORAN.md", (k) => labelId[k]);
console.table(rows);
console.log("Next: also update the 'Verified' table in README.md after you re-run the checks.");

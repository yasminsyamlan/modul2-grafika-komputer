/* Headless capture of the Three.js viewer (dev tool, NOT part of `npm test`).
 * Needs Playwright + Chromium (preinstalled in the authoring sandbox; on your
 * machine: `npx playwright install chromium` or just use the Export buttons by hand).
 *   node tools/capture_three.mjs [baseURL]
 * Writes: plan_three.png (fill on, centre-aligned lines)   + variants in out/ + screenshots in out/shots/ */
import { createRequire } from "node:module";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 4173, BASE = process.argv[2] || `http://localhost:${PORT}`;
let srv;
if (!process.argv[2]) {
  srv = spawn("npx", ["--yes", "serve", ".", "-l", String(PORT), "--no-clipboard"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 4000));
}
mkdirSync("out/shots", { recursive: true });
const threeSrc = readFileSync("node_modules/three/build/three.module.js", "utf8");

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const info = { chromium: browser.version(), three: JSON.parse(readFileSync("node_modules/three/package.json", "utf8")).version };
const ctx = await browser.newContext({ viewport: { width: 1300, height: 760 }, deviceScaleFactor: 2 });   // 2x on purpose: setPixelRatio(1) must neutralise it
const page = await ctx.newPage();
// the page loads three from jsdelivr; serve the pinned local copy so the capture is offline-reproducible
await page.route("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js", (r) =>
  r.fulfill({ status: 200, contentType: "text/javascript", body: threeSrc }));
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console.error:", m.text()); });

async function canvasPNG(url, file) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });
  const dataURL = await page.evaluate(() => document.getElementById("c").toDataURL("image/png"));
  const dims = await page.evaluate(() => [document.getElementById("c").width, document.getElementById("c").height, devicePixelRatio]);
  writeFileSync(file, Buffer.from(dataURL.split(",")[1], "base64"));
  return dims;
}
const dims = await canvasPNG(`${BASE}/web/?fill=1`, "plan_three.png");
console.log("canvas size / devicePixelRatio:", dims.join(" x "));
await canvasPNG(`${BASE}/web/?fill=0`, "out/plan_three_outline.png");
await canvasPNG(`${BASE}/web/?fill=1&half=0`, "out/plan_three_fill_half0.png");
await canvasPNG(`${BASE}/web/?fill=0&half=0`, "out/plan_three_outline_half0.png");

// screenshots for A5: normal / deuteranopia / protanopia / grayscale
await page.goto(`${BASE}/web/?fill=0`);
await page.waitForSelector("body[data-ready='1']");
await page.screenshot({ path: "out/shots/viewer_normal.png", fullPage: true });
for (const [id, name] of [["cvd", "deuteranopia"], ["cvd2", "protanopia"], ["gray", "grayscale"]]) {
  await page.check("#" + id);
  await page.screenshot({ path: `out/shots/viewer_${name}.png`, fullPage: true });
  await page.uncheck("#" + id);
}
writeFileSync("out/capture_info.json", JSON.stringify({ ...info, date: new Date().toISOString(), canvas: dims }, null, 2));
console.log(info);
await browser.close();
srv?.kill();

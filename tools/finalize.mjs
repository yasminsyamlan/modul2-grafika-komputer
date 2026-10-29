/* After you drop YOUR myplan.json in the repo root: regenerate every plan-dependent
 * artefact in one go and save the numbers for LAPORAN A4.
 *   node tools/finalize.mjs
 * Steps: tests -> draw_plan (fill) -> [capture Three.js if Playwright exists] -> compare -> bench */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
if (!existsSync("myplan.json")) { console.error("myplan.json not found in repo root (still on the pusaka_plan.json fallback)."); process.exit(1); }
mkdirSync("out", { recursive: true }); mkdirSync("report", { recursive: true });
let log = `# finalize ${new Date().toISOString()}  node ${process.version}\n`;
const run = (cmd, must = true) => {
  log += `\n$ ${cmd}\n`; console.log(`$ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || ""); log += out; console.log(out.trim().split("\n").slice(-6).join("\n"));
  if (r.status !== 0 && must) { writeFileSync("report/final_numbers.txt", log); console.error(`FAILED: ${cmd}`); process.exit(1); }
  return r.status === 0;
};
run("node tests.mjs");
run("node draw_plan.mjs --w 800 --h 600 --fill");
let havePng = false;
import { createRequire } from "node:module";
try { createRequire(import.meta.url)("playwright"); havePng = run("node tools/capture_three.mjs", false); } catch { /* no playwright */ }
if (!havePng) console.log("\n(no Playwright) -> open the page, use Export PNG at 800x600/pixelRatio 1, save as plan_three.png in the root, then re-run this script.");
if (existsSync("plan_three.png")) run("node compare.mjs out/plan_scratch.ppm plan_three.png --diff out/diff.png", false);
run("node bench.mjs");
writeFileSync("report/final_numbers.txt", log);
console.log("\nwrote report/final_numbers.txt -> copy the numbers into LAPORAN A4 and replace PREDICTION.md numbers if your plan changed.");

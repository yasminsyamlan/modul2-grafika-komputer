/* Module 2 / Lab 2.5 -- octant awareness: a 24-spoke asterisk (a spoke every
 * 15 degrees) around one centre. Every spoke must have the same length within
 * +-1 pixel, otherwise one of the eight octants is wrong.
 *   node octant_test.mjs [--r 45]                                           */
import { Framebuffer, asterisk, lineDDA, lineBresenham } from "./raster.mjs";
import { mkdirSync } from "node:fs";

const i = process.argv.indexOf("--r");
const R = i >= 0 ? +process.argv[i + 1] : 45;
const SIZE = 2 * R + 11, C = R + 5;
mkdirSync("out", { recursive: true });
const fb = new Framebuffer(SIZE, SIZE, [18, 18, 22]);
const spokes = asterisk(fb, C, C, R, 24);
fb.writePPM("out/asterisk.ppm");

console.log(`centre (${C},${C})  radius ${R}px  24 spokes\n`);
console.log("angle  end        pixels  euclid  |len-R|  octant");
let worst = 0, pass = true;
for (const s of spokes) {
  const err = Math.abs(s.euclid - R);
  worst = Math.max(worst, err);
  const octant = Math.floor(((s.angleDeg % 360) / 45)) + 1;
  console.log(`${String(s.angleDeg).padStart(4)}   (${String(s.end[0]).padStart(3)},${String(s.end[1]).padStart(3)})  ${String(s.pixels).padStart(5)}  ${s.euclid.toFixed(2).padStart(7)}  ${err.toFixed(2).padStart(6)}   ${octant}`);
  if (err > 1) pass = false;
  // DDA and Bresenham must agree on the end points and pixel count
  const d = lineDDA(C, C, s.end[0], s.end[1]), b = lineBresenham(C, C, s.end[0], s.end[1]);
  if (d.length !== b.length) { pass = false; console.log("   DDA/Bresenham length mismatch"); }
}
// mirror symmetry: spokes related by a reflection (x<->-x, y<->-y, x<->y) have equal pixel counts
const byAng = new Map(spokes.map((s) => [s.angleDeg, s.pixels]));
for (const a of [15, 30, 60, 75]) {
  const mirrors = [180 - a, 180 + a, 360 - a, 90 - a, 90 + a, 270 - a, 270 + a].map((m) => ((m % 360) + 360) % 360);
  for (const m of mirrors) if (byAng.get(m) !== byAng.get(a) && byAng.has(m)) { pass = false; console.log(`   mirror mismatch ${a} vs ${m}`); }
}
console.log(`\nworst | euclid - R | = ${worst.toFixed(2)} px   -> ${pass ? "PASS (all 8 octants correct)" : "FAIL"}`);
console.log("wrote out/asterisk.ppm");
if (!pass) process.exit(1);

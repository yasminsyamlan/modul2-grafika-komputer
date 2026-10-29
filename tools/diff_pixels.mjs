/* list the pixels where two rasters differ:  node tools/diff_pixels.mjs A B */
import { Framebuffer } from "../raster.mjs";
import { decodePNG } from "../png.mjs";
import { readFileSync } from "node:fs";
const ld = (p) => (p.endsWith(".png") ? decodePNG(readFileSync(p)) : Framebuffer.readPPM(p));
const [A, B] = process.argv.slice(2).map(ld);
const out = [];
for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
  const a = A.get(x, y), b = B.get(x, y);
  if (a.some((v, k) => v !== b[k])) out.push({ x, y, a, b });
}
console.log(out.length, "differing pixels");
for (const o of out) console.log(`(${o.x},${o.y}) scratch=${o.a} three=${o.b}`);

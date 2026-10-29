/* Convert small PPM evidence images to enlarged PNGs for the report (nearest-neighbour). */
import { Framebuffer } from "../raster.mjs";
import { encodePNG } from "../png.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("report", { recursive: true });
const up = (fb, k) => { const o = new Framebuffer(fb.w * k, fb.h * k);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, fb.get((x / k) | 0, (y / k) | 0)); return o; };
const jobs = [
  ["out/gap_coverage_buggy.ppm", "report/gap_coverage_buggy.png", 24],
  ["out/gap_coverage_cracks.ppm", "report/gap_coverage_cracks.png", 24],
  ["out/gap_coverage_fixed.ppm", "report/gap_coverage_fixed.png", 24],
  ["out/square_fill.ppm", "report/square_fill.png", 24],
  ["out/square_outline.ppm", "report/square_outline.png", 24],
  ["ref/tri_ref.ppm", "report/tri_ref.png", 24],
  ["out/asterisk.ppm", "report/asterisk.png", 4],
  ["out/wu_linear.ppm", "report/wu_linear.png", 16],
  ["out/wu_naive.ppm", "report/wu_naive.png", 16],
  ["out/wu_bresenham.ppm", "report/wu_bresenham.png", 16],
  ["out/plan_scratch_fill.ppm", "report/plan_scratch_fill.png", 1],
];
for (const [i, o, k] of jobs) writeFileSync(o, encodePNG(up(Framebuffer.readPPM(i), k)));
console.log("wrote", jobs.length, "report images");

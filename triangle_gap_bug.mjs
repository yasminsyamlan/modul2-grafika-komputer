/* Module 2 -- DIAGNOSE-AND-FIX: shared-edge cracks / double-draws.
 *
 * The bug artifact: a quad drawn as two triangles WITHOUT the top-left rule.
 * Lab 2 task -- from the rendered pixels only, before reading the fix:
 *   1. show which pixels are covered twice (or missing) and count them;
 *   2. state the cause;
 *   3. switch to the top-left rule;
 *   4. prove 0 doubles and 0 gaps.
 *
 *   node triangle_gap_bug.mjs            # prints the evidence for all steps
 */
import { Framebuffer, triangle, coverage, edge, totalArea2 } from "./raster.mjs";
import { mkdirSync } from "node:fs";

mkdirSync("out", { recursive: true });

// same 6x6 square + diagonal as the Fully Worked Example
const T1 = [[2, 2], [8, 2], [8, 8]];
const T2 = [[2, 2], [8, 8], [2, 8]];
const W = 12, H = 12;

// ---------------------------------------------------------------- step 1
// Diagnosis from PIXELS ONLY: draw each triangle into its OWN layer, then look
// at which pixels are lit in both layers. (No access to rasteriser internals.)
function layer(tri, opts) {
  const fb = new Framebuffer(W, H);
  triangle(fb, tri[0], tri[1], tri[2], [255, 255, 255], opts);
  const lit = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fb.get(x, y)[0]) lit.add(`${x},${y}`);
  return lit;
}
const noRule = { topLeft: false };
const l1 = layer(T1, noRule), l2 = layer(T2, noRule);
const doubled = [...l1].filter((p) => l2.has(p));
console.log("== step 1: which pixels are drawn twice? (buggy: >= 0, no rule) ==");
console.log(`layer T1: ${l1.size} px   layer T2: ${l2.size} px   union: ${new Set([...l1, ...l2]).size} px   doubled: ${doubled.length}`);
console.log("doubled pixels:", doubled.map((p) => `(${p})`).join(" "));
console.log(`all satisfy x == y: ${doubled.every((p) => { const [x, y] = p.split(",").map(Number); return x === y; })}`);

// ---------------------------------------------------------------- step 2
console.log("\n== step 2: cause ==");
for (const p of doubled.slice(0, 2)) {
  const [x, y] = p.split(",").map(Number), px = x + 0.5, py = y + 0.5;
  const e1 = edge(...T1[2], ...T1[0], px, py);        // T1's diagonal edge C->A
  const e2 = edge(...T2[0], ...T2[1], px, py);        // T2's diagonal edge A->B
  console.log(`pixel (${x},${y}) centre (${px},${py}):  E_T1(C->A) = ${e1}   E_T2(A->B) = ${e2}   -> both == 0, "E >= 0" accepts both`);
}
console.log("=> the pixel centres lie EXACTLY on the shared edge y = x; each triangle sees E == 0 and claims it.");

// ---------------------------------------------------------------- step 3/4
function run(label, opts) {
  const fb = new Framebuffer(W, H);
  triangle(fb, T1[0], T1[1], T1[2], [230, 120, 40], opts);
  triangle(fb, T2[0], T2[1], T2[2], [40, 130, 180], opts);
  const cov = coverage(W, H, [T1, T2], opts);
  console.log(`${label.padEnd(30)} once=${cov.once}  twice=${cov.twice}  gaps=${cov.gaps}`);
  return { fb, cov };
}
console.log("\n== step 3/4: fix and proof ==");
const buggy = run("naive >=0 (no rule)", { topLeft: false });
const cracks = run("strict >0 (no rule)", { topLeft: false, strictGreater: true });
const fixed = run("top-left rule (module)", { topLeft: true });
const d3d = run("top-left rule (d3d)", { topLeft: true, rule: "d3d" });

// coverage image: red = covered twice, grey = once, black = not covered, blue = crack
function covImage(cov, crack) {
  const img = new Framebuffer(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = cov.counts[y * W + x];
      img.set(x, y, c >= 2 ? [220, 30, 30] : c === 1 ? [120, 120, 120] : crack?.(x, y) ? [30, 90, 255] : [0, 0, 0]);
    }
  return img;
}
covImage(buggy.cov).writePPM("out/gap_coverage_buggy.ppm");
covImage(cracks.cov, (x, y) => x === y && x >= 2 && x <= 7).writePPM("out/gap_coverage_cracks.ppm");
covImage(fixed.cov).writePPM("out/gap_coverage_fixed.ppm");
fixed.fb.writePPM("out/gap_fixed.ppm");

console.log("\nwhich edge gets what (module rule, y-down, total > 0), T1 = (2,2),(8,2),(8,8):");
const rules = { "module": (dx, dy) => (dy === 0 && dx < 0) || dy > 0, "d3d": (dx, dy) => (dy === 0 && dx > 0) || dy < 0 };
for (const [name, tri] of [["T1", T1], ["T2", T2]])
  for (let i = 0; i < 3; i++) {
    const a = tri[i], b = tri[(i + 1) % 3], dx = b[0] - a[0], dy = b[1] - a[1];
    console.log(`  ${name} edge (${a})->(${b})  d=(${dx},${dy})  bias module: ${rules.module(dx, dy) ? " 0" : "-1"}   d3d: ${rules.d3d(dx, dy) ? " 0" : "-1"}`);
  }

console.log("\nroot cause : pixels whose centre lies exactly on the shared edge");
console.log("             have an edge function == 0 in BOTH triangles.");
console.log("the fix    : per-edge ownership (top-left) -- bias 0 for an owned edge,");
console.log("             -1 (= strict) otherwise -- so each on-edge pixel is claimed once.");
console.log(`proof      : top-left rule -> twice=${fixed.cov.twice}, gaps=${fixed.cov.gaps} (module), twice=${d3d.cov.twice}, gaps=${d3d.cov.gaps} (d3d)`);

// ------------------------------------------------------------- 2nd finding
// The listing's integer bias (0 / -1) is only exact for integer E. Re-create it
// verbatim and run it on a quad whose diagonal has an ODD (dx - dy): E is then a
// half-integer and "E + (-1) >= 0" drops pixels that are strictly inside.
function triangleListing(fb, A, B, C, rgb) {          // the module's Listing 2, y-down, total > 0
  const bias = (xx, xy, yx, yy) => { const dx = yx - xx, dy = yy - xy; return (dy === 0 && dx < 0) || dy > 0 ? 0 : -1; };
  const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(fb.w - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(fb.h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  const bBC = bias(B[0], B[1], C[0], C[1]), bCA = bias(C[0], C[1], A[0], A[1]), bAB = bias(A[0], A[1], B[0], B[1]);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (edge(B[0], B[1], C[0], C[1], px, py) + bBC >= 0 && edge(C[0], C[1], A[0], A[1], px, py) + bCA >= 0 && edge(A[0], A[1], B[0], B[1], px, py) + bAB >= 0) fb.set(x, y, rgb);
  }
}
{
  const P = [[1, 1], [8, 1], [8, 5], [1, 5]];                // 7 x 4 rectangle, diagonal dx=7, dy=4
  const Q1 = [P[0], P[1], P[2]], Q2 = [P[0], P[2], P[3]];
  const old = new Framebuffer(12, 8), neu = new Framebuffer(12, 8);
  triangleListing(old, ...Q1, [255, 255, 255]); triangleListing(old, ...Q2, [255, 255, 255]);
  triangle(neu, ...Q1); triangle(neu, ...Q2);
  const missing = [];
  for (let y = 1; y < 5; y++) for (let x = 1; x < 8; x++) if (neu.get(x, y)[0] && !old.get(x, y)[0]) missing.push(`(${x},${y})`);
  console.log("\n== 2nd finding: listing's integer bias vs exact tie-break, 7x4 rectangle split on a 7:4 diagonal ==");
  console.log(`listing (E + bias >= 0): pixels missing vs exact: ${missing.length}  ${missing.join(" ")}`);
  const strictInside = (x, y) => P.every((a, i) => { const b = P[(i + 1) % 4]; return edge(a[0], a[1], b[0], b[1], x + .5, y + .5) > 0; });
  console.log(`  strictly inside the rectangle: ${missing.every((p) => { const [x, y] = p.slice(1, -1).split(",").map(Number); return strictInside(x, y); })}  (they are NOT on any edge -> a real crack)`);
  const c = coverage(12, 8, [Q1, Q2], {});
  console.log(`exact tie-break        : once=${c.once} twice=${c.twice} gaps=${c.gaps}   (rectangle has ${7 * 4} pixel centres)`);
  if (!(c.once === 28 && c.twice === 0 && c.gaps === 0)) throw new Error("exact rule not watertight on 7x4");
}

console.log("\nwrote out/gap_coverage_buggy.ppm (red = double), out/gap_coverage_cracks.ppm (blue = crack), out/gap_coverage_fixed.ppm, out/gap_fixed.ppm");
if (!(fixed.cov.twice === 0 && fixed.cov.gaps === 0 && d3d.cov.twice === 0 && d3d.cov.gaps === 0))
  throw new Error("top-left rule did not produce a watertight fill");

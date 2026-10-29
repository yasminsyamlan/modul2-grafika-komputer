/* Module 2 / Lab 3.4 -- are the five legend categories still distinguishable
 * under simulated deuteranopia / protanopia / grayscale?
 * Applies the SAME 3x3 matrices as web/index.html's SVG filters in LINEAR RGB
 * (SVG feColorMatrix default colour space), then measures pairwise CIELAB
 * delta-E76 and L* gaps. Also WCAG contrast of each swatch against the canvas.
 *   node cvd_check.mjs            exit 1 if any pair falls below the threshold */
import { CATEGORY_RGB } from "./plan.mjs";

const MAT = {
  none: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],   // = index.html
  protanopia:   [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
};
const toLin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
const apply = (m, rgb) => { const l = rgb.map(toLin); return m.map((r) => Math.min(1, Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2]))); };
const lum = (l) => 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
function lab(l) {                                   // linear sRGB -> CIELAB (D65)
  const X = 0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2], Y = lum(l), Z = 0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const THRESH = 5, GOOD = 10;   // FAIL below 5 (~2 JND; JND ~ 2.3); >= 10 is 'clearly different at a glance'
const BG = [18, 18, 22];
const cats = Object.keys(CATEGORY_RGB);
let ok = true;
console.log(`thresholds: FAIL if min pairwise dE76 < ${THRESH}; 'marginal' if < ${GOOD} (colour alone is not enough there -> marker + label carry it)`);
for (const mode of ["none", "deuteranopia", "protanopia", "grayscale"]) {
  const sim = Object.fromEntries(cats.map((c) => {
    let l = apply(MAT[mode] ?? MAT.none, CATEGORY_RGB[c]);
    if (mode === "grayscale") { const y = lum(l); l = [y, y, y]; }
    return [c, l];
  }));
  let min = Infinity, pair = "";
  for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
    const d = dE(lab(sim[cats[i]]), lab(sim[cats[j]]));
    if (d < min) { min = d; pair = `${cats[i]}/${cats[j]}`; }
  }
  const Ls = cats.map((c) => lab(sim[c])[0].toFixed(0).padStart(3)).join(" ");
  console.log(`${mode.padEnd(13)} L* [${cats.join(" ")}] = ${Ls}   min dE76 = ${min.toFixed(1)} (${pair})  ${min >= GOOD ? "OK" : min >= THRESH ? "marginal (marker+label needed)" : "TOO CLOSE"}`);
  if (min < THRESH) ok = false;
}
console.log("\nWCAG contrast of each category colour vs the canvas background rgb(18,18,22):");
const yb = lum(BG.map(toLin));
for (const c of cats) {
  const y = lum(CATEGORY_RGB[c].map(toLin));
  const cr = (Math.max(y, yb) + 0.05) / (Math.min(y, yb) + 0.05);
  console.log(`  ${c.padEnd(7)} ${cr.toFixed(2)}:1  ${cr >= 3 ? "" : "<-- below 3:1 (non-text UI minimum)"}`);
}
if (!ok) process.exit(1);

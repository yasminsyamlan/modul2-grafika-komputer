/* Module 2 / Lab 2.3 -- sample-centre check (Example E1).
 * Fill a 2x2 rectangle at (1,1) on a 6x6 framebuffer with the CENTRE rule and
 * with the WRONG (corner-sampling, closed-interval) rule; then count how many
 * source texels a bilinear blit touches per output pixel with / without the
 * -1/2 offset.
 *   node sample_centre.mjs                                                  */
import { Framebuffer } from "./raster.mjs";

const N = 6, X0 = 1, X1 = 3, Y0 = 1, Y1 = 3;   // rectangle [1,3) x [1,3)
const grid = (pred) => {
  const fb = new Framebuffer(N, N), lit = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (pred(x, y)) { fb.set(x, y, [255, 255, 255]); lit.push(`(${x},${y})`); }
  const rows = [];
  for (let y = 0; y < N; y++) { let r = ""; for (let x = 0; x < N; x++) r += fb.get(x, y)[0] ? "# " : ". "; rows.push(r); }
  return { lit, rows };
};

// correct: sample at the pixel CENTRE, half-open interval  x0 <= x+.5 < x1
const centre = grid((x, y) => x + 0.5 >= X0 && x + 0.5 < X1 && y + 0.5 >= Y0 && y + 0.5 < Y1);
// wrong: sample at the pixel CORNER, closed interval        x0 <= x <= x1
const corner = grid((x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1);

console.log("(a) centre rule  :", centre.lit.length, "pixels", centre.lit.join(" "));
centre.rows.forEach((r) => console.log("      " + r));
console.log("(b) corner rule  :", corner.lit.length, "pixels (3x3 block, one row + one column too many)");
corner.rows.forEach((r) => console.log("      " + r));

// (c) bilinear blit. Source texel k covers [k,k+1) and its CENTRE is k+1/2.
//     Bilinear at continuous source coordinate u reads taps t = u - 1/2:
//     frac(t) == 0 -> 1 texel (exact copy);  frac(t) != 0 -> 2 texels per axis.
//     D3D9 puts the output pixel centre on an INTEGER source coordinate (the
//     texel CORNER) unless you shift by -1/2 -> frac(t) = 1/2 -> 2x2 = 4 taps.
const taps = (u) => (Math.abs(u - 0.5 - Math.floor(u - 0.5)) < 1e-9 ? 1 : 2);
const uCorner = 1.0;
const noOff = taps(uCorner) ** 2;                         // pixel centre hits the texel corner
console.log("\n(c) bilinear blit of a 2x2 texture whose output pixel centres land on texel CORNERS:");
console.log(`    without the -1/2 offset: ${noOff} texels per output pixel (weight 1/4 each) -> uniform blur`);
console.log(`    with the -1/2 offset (centre on texel centre u = 1.5): ${taps(1.5) ** 2} texel (weight 1) -> exact copy`);
if (centre.lit.length !== 4 || corner.lit.length !== 9 || noOff !== 4 || taps(1.5) !== 1) throw new Error("E1 mismatch");

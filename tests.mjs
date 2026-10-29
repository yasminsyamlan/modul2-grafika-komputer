/* Module 2 -- run every from-scratch check. `npm test` / `node tests.mjs`.
 * Exit 0 iff all pass. Covers the hand-checkable invariants of Examples
 * E1-E5, watertightness (top-left rule), and the reference raster match. */
import {
  Framebuffer, lineDDA, lineBresenham, edge, triangle, barycentric, coverage,
  lineWu, asterisk, blendPixel,
} from "./raster.mjs";
import { makeWorldToScreen, loadPlan, validatePlan, defaultPlanPath } from "./plan.mjs";
import { pixelStats } from "./metrics.mjs";
import { encodePNG, decodePNG } from "./png.mjs";
import { existsSync, mkdirSync } from "node:fs";

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, fn) {
  try { fn(); console.log("OK   " + name); pass++; }
  catch (e) { console.log("FAIL " + name + "\n     " + e.message); fail++; }
}
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };

const RUNLINE = [[2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5]];

check("E2 -- lineDDA (2,1)->(9,5) gives the 8-pixel staircase", () => {
  assert(eq(lineDDA(2, 1, 9, 5), RUNLINE), "DDA pixel list mismatch");
});

check("E3 -- lineBresenham (2,1)->(9,5) matches DDA, integers only", () => {
  assert(eq(lineBresenham(2, 1, 9, 5), RUNLINE), "Bresenham pixel list mismatch");
});

check("lines -- all 8 octants: the reflected segment has the same length", () => {
  const base = lineBresenham(0, 0, 9, 4).length; // 10
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
    for (const [a, b] of [[9, 4], [4, 9]]) {
      const n = lineBresenham(0, 0, sx * a, sy * b).length;
      assert(n === Math.max(a, b) + 1, `octant ${sx},${sy},${a},${b}: ${n}`);
    }
  assert(base === 10, "baseline length");
});

check("E4 -- edge-function signs for A(1,1) B(6,2) C(3,7)", () => {
  const A = [1, 1], B = [6, 2], C = [3, 7];
  const total = edge(A[0], A[1], B[0], B[1], C[0], C[1]);
  assert(total === 28, `total ${total} != 28`);
  const E = (P) => [
    edge(A[0], A[1], B[0], B[1], P[0], P[1]),
    edge(B[0], B[1], C[0], C[1], P[0], P[1]),
    edge(C[0], C[1], A[0], A[1], P[0], P[1]),
  ];
  assert(eq(E([3, 3]), [8, 12, 8]), "P1 (3,3) edge values");
  assert(E([5, 5]).some((v) => v < 0), "P2 (5,5) should be outside");
  assert(E([1, 4]).some((v) => v < 0), "P3 (1,4) should be outside");
  assert(E([3, 3]).every((v) => v >= 0), "P1 (3,3) should be inside");
});

check("E5 -- barycentric interpolation 10/20/40 at (.5,.25,.25) = 20", () => {
  const A = [0, 0], B = [4, 0], C = [0, 4];
  // point with barycentric (0.5, 0.25, 0.25): P = .5A + .25B + .25C = (1,1)
  const [la, lb, lc] = barycentric(A, B, C, [1, 1]);
  assert(Math.abs(la + lb + lc - 1) < 1e-12, "weights sum to 1");
  assert(Math.abs(la - 0.5) < 1e-12 && Math.abs(lb - 0.25) < 1e-12 && Math.abs(lc - 0.25) < 1e-12,
    `weights ${la},${lb},${lc}`);
  const v = la * 10 + lb * 20 + lc * 40;
  assert(Math.abs(v - 20) < 1e-12, `interp ${v} != 20`);
});

check("top-left rule -- 6x6 square split on y=x: every pixel covered once", () => {
  const T1 = [[2, 2], [8, 2], [8, 8]], T2 = [[2, 2], [8, 8], [2, 8]];
  const c = coverage(12, 12, [T1, T2], { topLeft: true });
  assert(c.once === 36 && c.twice === 0 && c.gaps === 0,
    `once=${c.once} twice=${c.twice} gaps=${c.gaps}`);
});

check("no top-left rule -- same square shows the seam (>=0: doubles; >0: gaps)", () => {
  const T1 = [[2, 2], [8, 2], [8, 8]], T2 = [[2, 2], [8, 8], [2, 8]];
  const dbl = coverage(12, 12, [T1, T2], { topLeft: false });
  const crk = coverage(12, 12, [T1, T2], { topLeft: false, strictGreater: true });
  assert(dbl.twice === 6 && dbl.gaps === 0, `>=0: twice=${dbl.twice} gaps=${dbl.gaps}`);
  assert(crk.twice === 0 && crk.gaps === 6, `>0: twice=${crk.twice} gaps=${crk.gaps}`);
});

check("E1 -- sample-centre: a 2x2 rect at (1,1) lights exactly (1,1),(2,1),(1,2),(2,2)", () => {
  const fb = new Framebuffer(6, 6);
  // fill x in [1,3), y in [1,3) by centre rule
  const lit = [];
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      if (cx >= 1 && cx < 3 && cy >= 1 && cy < 3) { fb.set(x, y, [255, 255, 255]); lit.push([x, y]); }
    }
  assert(eq(lit, [[1, 1], [2, 1], [1, 2], [2, 2]]), `lit ${JSON.stringify(lit)}`);
});

check("plan -- worldToScreen flips y once and is invertible on a known point", () => {
  const plan = loadPlan("pusaka_plan.json");
  const H = 600;
  const w2s = makeWorldToScreen(plan, H);
  const s = plan.scale_px_per_m, [ox, oy] = plan.origin_m;
  const p = w2s([0, 0]);
  assert(p[0] === Math.round(ox * s), `x ${p[0]}`);
  assert(p[1] === Math.round(H - 1 - oy * s), `y ${p[1]}`);
  // moving +y in world moves UP on screen (smaller y)
  assert(w2s([0, 5])[1] < w2s([0, 0])[1], "y not flipped");
});

check("reference raster -- draw_square fill is byte-identical to ref/square_fill_ref.ppm", () => {
  if (!existsSync("ref/square_fill_ref.ppm")) {
    console.log("     (ref missing -- generating it now; commit ref/ after first run)");
    mkdirSync("ref", { recursive: true });
    const g = new Framebuffer(12, 12);
    triangle(g, [2, 2], [8, 2], [8, 8], [230, 120, 40]);
    triangle(g, [2, 2], [8, 8], [2, 8], [40, 130, 180]);
    g.writePPM("ref/square_fill_ref.ppm");
  }
  const fb = new Framebuffer(12, 12);
  triangle(fb, [2, 2], [8, 2], [8, 8], [230, 120, 40]);
  triangle(fb, [2, 2], [8, 8], [2, 8], [40, 130, 180]);
  const ref = Framebuffer.readPPM("ref/square_fill_ref.ppm");
  const st = pixelStats(fb, ref);
  assert(st.identical === st.total && st.maxAbs === 0,
    `identical ${st.identical}/${st.total}, max|diff| ${st.maxAbs}`);
});


// ===================================================== Lab 2 additions ======
// independent oracle: p is covered iff p + s*(eps, eps^2) is strictly inside
// (s=+1 true top-left / d3d, s=-1 the module listing's rule). Lexicographic sign
// of E(p + s*(eps,eps^2)) = (E, -s*dy, s*dx). Shares no code with raster.mjs.
const oracleCovered = (tri, px, py, s) => {
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = tri[i], [bx, by] = tri[(i + 1) % 3];
    const dx = bx - ax, dy = by - ay, e = dx * (py - ay) - dy * (px - ax);
    const k = e !== 0 ? Math.sign(e) : -s * dy !== 0 ? Math.sign(-s * dy) : Math.sign(s * dx);
    if (k <= 0) return false;
  }
  return true;
};
const rng = (() => { let a = 12345; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 2 ** 32); })();
const ri = (n) => Math.floor(rng() * n);

check("tri_ref -- triangle(A(1,1),B(6,2),C(3,7)) is byte-identical to the independent Python reference", () => {
  for (const [rule, f] of [["module", "ref/tri_ref.ppm"], ["d3d", "ref/tri_ref_d3d.ppm"]]) {
    const fb = new Framebuffer(8, 9);
    triangle(fb, [1, 1], [6, 2], [3, 7], [230, 120, 40], { rule });
    const st = pixelStats(fb, Framebuffer.readPPM(f));
    assert(st.identical === st.total && st.maxAbs === 0, `${rule}: identical ${st.identical}/${st.total}, max|diff| ${st.maxAbs}`);
  }
});

check("triangle -- 3000 random triangles agree with the exact oracle (both rules, incl. on-edge pixels)", () => {
  let n = 0;
  for (let t = 0; t < 3000; t++) {
    const tri = [[ri(16), ri(16)], [ri(16), ri(16)], [ri(16), ri(16)]];
    const tot = edge(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1]);
    if (tot === 0) continue;
    const [A, B, C] = tot > 0 ? tri : [tri[0], tri[2], tri[1]];
    for (const [rule, s] of [["module", -1], ["d3d", 1]]) {
      const got = new Set();
      triangle({ w: 16, h: 16 }, A, B, C, null, { rule, onFragment: (x, y) => got.add(y * 16 + x) });
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const want = oracleCovered([A, B, C], x + 0.5, y + 0.5, s);
        assert(want === got.has(y * 16 + x), `${rule} tri ${JSON.stringify([A, B, C])} pixel (${x},${y}): want ${want}`);
        n++;
      }
    }
  }
  assert(n > 100000, "too few comparisons");
});

check("watertight -- 1500 random convex quads (any slope, both rules): every interior pixel exactly once", () => {
  let quads = 0;
  for (let t = 0; t < 1500; t++) {
    const P = [[ri(22), ri(22)], [ri(22), ri(22)], [ri(22), ri(22)], [ri(22), ri(22)]];
    const cx = P.reduce((q, p) => q + p[0], 0) / 4, cy = P.reduce((q, p) => q + p[1], 0) / 4;
    P.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
    const o = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (P.some((_, i) => o(P[i], P[(i + 1) % 4], P[(i + 2) % 4]) <= 0)) continue;
    quads++;
    for (const rule of ["module", "d3d"]) {
      const c = coverage(24, 24, [[P[0], P[1], P[2]], [P[0], P[2], P[3]]], { rule });
      assert(c.twice === 0 && c.gaps === 0, `${rule} quad ${JSON.stringify(P)}: twice=${c.twice} gaps=${c.gaps}`);
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const inside = P.every((a, i) => { const b = P[(i + 1) % 4]; return edge(a[0], a[1], b[0], b[1], x + .5, y + .5) > 0; });
        if (inside) assert(c.counts[y * 24 + x] === 1, `${rule} interior pixel (${x},${y}) count ${c.counts[y * 24 + x]}`);
      }
    }
  }
  assert(quads > 500, `only ${quads} usable quads`);
});

check("winding -- reversed triangle is still filled with autoFlip, vanishes without", () => {
  const a = new Framebuffer(8, 9), b = new Framebuffer(8, 9), c = new Framebuffer(8, 9);
  const n1 = triangle(a, [1, 1], [6, 2], [3, 7]);
  const n2 = triangle(b, [1, 1], [3, 7], [6, 2]);
  const n3 = triangle(c, [1, 1], [3, 7], [6, 2], [255, 255, 255], { autoFlip: false });
  assert(n1 === 14 && n2 === 14 && n3 === 0, `${n1} ${n2} ${n3}`);
  assert(pixelStats(a, b).identical === 72, "flipped image differs");
});

check("octants -- 24-spoke asterisk: every spoke length within +-1 px of R, DDA and Bresenham agree", () => {
  const R = 45, fb = new Framebuffer(101, 101);
  const sp = asterisk(fb, 50, 50, R, 24);
  assert(sp.length === 24, "spoke count");
  for (const s of sp) {
    assert(Math.abs(s.euclid - R) <= 1, `spoke ${s.angleDeg} deg: length ${s.euclid.toFixed(2)}`);
    assert(lineDDA(50, 50, s.end[0], s.end[1]).length === s.pixels, `DDA/Bresenham count at ${s.angleDeg}`);
  }
});

check("lineBresenham -- exact endpoints, 8-connected, no repeats, for 5000 random segments", () => {
  for (let t = 0; t < 5000; t++) {
    const a = [ri(60) - 10, ri(60) - 10], b = [ri(60) - 10, ri(60) - 10];
    const pts = lineBresenham(a[0], a[1], b[0], b[1]);
    assert(pts[0][0] === a[0] && pts[0][1] === a[1], "start");
    assert(pts.at(-1)[0] === b[0] && pts.at(-1)[1] === b[1], "end");
    assert(pts.length === Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) + 1, `length ${JSON.stringify([a, b])}`);
    for (let i = 1; i < pts.length; i++)
      assert(Math.max(Math.abs(pts[i][0] - pts[i - 1][0]), Math.abs(pts[i][1] - pts[i - 1][1])) === 1, "not 8-connected");
  }
});

check("Wu line -- linear-light blend conserves light; naive sRGB blend loses it", () => {
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const sum = (fb) => { let s = 0; for (let i = 0; i < fb.data.length; i += 3) s += lin(fb.data[i]); return s; };
  const a = new Framebuffer(40, 20), b = new Framebuffer(40, 20);
  lineWu(2, 3.5, 38, 13.25, a, [255, 255, 255], { linear: true });
  lineWu(2, 3.5, 38, 13.25, b, [255, 255, 255], { linear: false });
  assert(Math.abs(sum(a) / 36 - 1) < 0.08, `linear light/col ${sum(a) / 36}`);
  assert(sum(b) < 0.8 * sum(a), `naive ${sum(b)} vs linear ${sum(a)}`);
  const h = new Framebuffer(10, 6); blendPixel(h, 1, 1, [255, 255, 255], 0.5, true);
  assert(h.get(1, 1)[0] === 188, `50% white in linear light is sRGB 188, got ${h.get(1, 1)[0]}`);
});

check("sample-centre -- corner sampling over-fills a 2x2 rectangle to 3x3", () => {
  let n = 0;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (x >= 1 && x <= 3 && y >= 1 && y <= 3) n++;
  assert(n === 9, "corner rule count");
});

check("PNG codec -- encode -> decode round-trips a framebuffer and rejects garbage", () => {
  const fb = new Framebuffer(13, 7);
  for (let i = 0; i < fb.data.length; i++) fb.data[i] = (i * 37) & 255;
  const back = decodePNG(encodePNG(fb));
  assert(back.w === 13 && back.h === 7 && pixelStats(fb, back).identical === 91, "round-trip mismatch");
  let threw = false; try { decodePNG(Buffer.from("not a png at all")); } catch { threw = true; }
  assert(threw, "garbage must throw, never decode as 'all zero'");
});

check("plan -- the active plan file passes schema validation (and lists Lab 1 minimum content)", () => {
  const path = defaultPlanPath();
  const { errors, warnings } = validatePlan(loadPlan(path));
  assert(errors.length === 0, `${path}: ${errors.join("; ")}`);
  assert(warnings.length === 0, `${path}: ${warnings.join("; ")}`);
});

console.log(`\n${fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECK(S) FAILED"}  (${pass} ok, ${fail} fail)`);
process.exit(fail === 0 ? 0 : 1);
